from rest_framework import views, viewsets, permissions, status, filters
from rest_framework.response import Response
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser
from .models import CompanySettings, AuditLog, record_audit_log, ExchangeRate, CompanyService
from .serializers import CompanySettingsSerializer, AuditLogSerializer, ExchangeRateSerializer, CompanyServiceSerializer
from apps.accounts.permissions import IsAdminUserRole

class CompanySettingsView(views.APIView):
    """
    Get company settings (authenticated users)
    Update company settings (Administrators only)
    """
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def get_permissions(self):
        if self.request.method in permissions.SAFE_METHODS:
            return [permissions.IsAuthenticated()]
        return [IsAdminUserRole()]

    def get(self, request):
        settings_obj = CompanySettings.get_solo()
        serializer = CompanySettingsSerializer(settings_obj, context={'request': request})
        return Response(serializer.data)

    def patch(self, request):
        settings_obj = CompanySettings.get_solo()
        serializer = CompanySettingsSerializer(
            settings_obj,
            data=request.data,
            partial=True,
            context={'request': request}
        )
        if serializer.is_valid():
            serializer.save(updated_by=request.user)
            record_audit_log(
                user=request.user,
                action='COMPANY_SETTINGS_UPDATED',
                module='SETTINGS',
                entity_id=str(settings_obj.id),
                description='Company settings / logo updated',
                ip_address=request.META.get('REMOTE_ADDR')
            )
            return Response(serializer.data)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    def put(self, request):
        return self.patch(request)


class AuditLogViewSet(viewsets.ReadOnlyModelViewSet):
    """
    View audit logs (Administrators and Sales Managers).
    """
    serializer_class = AuditLogSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        if user.is_administrator or user.is_sales_manager:
            qs = AuditLog.objects.all().select_related('user')
        else:
            # Other roles only see their own logs
            qs = AuditLog.objects.filter(user=user).select_related('user')

        module = self.request.query_params.get('module')
        action = self.request.query_params.get('action')
        search = self.request.query_params.get('search')

        if module:
            qs = qs.filter(module__iexact=module)
        if action:
            qs = qs.filter(action__icontains=action)
        if search:
            qs = qs.filter(description__icontains=search)

        return qs


class ExchangeRateViewSet(viewsets.ModelViewSet):
    """
    View exchange rates (all authenticated users)
    Update/Create exchange rates (Admin and Sales Manager only)
    """
    serializer_class = ExchangeRateSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        # Auto initialize default rates if table is empty
        if not ExchangeRate.objects.exists():
            default_rates = [
                ('PKR', 1.0000, 'Base Currency (PKR)'),
                ('USD', 278.5000, 'Official Bank Rate'),
                ('GBP', 352.0000, 'Official Bank Rate'),
                ('EUR', 301.0000, 'Official Bank Rate'),
                ('AED', 75.8000, 'Official Bank Rate'),
                ('SAR', 74.2000, 'Official Bank Rate'),
                ('CAD', 203.0000, 'Official Bank Rate'),
            ]
            for code, rate, src in default_rates:
                ExchangeRate.objects.get_or_create(currency_code=code, defaults={'rate_to_base': rate, 'source': src})

        return ExchangeRate.objects.all().order_by('currency_code')

    def check_permissions(self, request):
        super().check_permissions(request)
        if request.method not in permissions.SAFE_METHODS:
            user = request.user
            if not (user.is_administrator or user.is_sales_manager):
                self.permission_denied(request, message="Only administrators and sales managers can modify exchange rates.")

    def perform_create(self, serializer):
        rate = serializer.save(updated_by=self.request.user)
        record_audit_log(
            user=self.request.user,
            action='EXCHANGE_RATE_CREATED',
            module='SETTINGS',
            entity_id=rate.currency_code,
            description=f"Exchange rate {rate.currency_code} created: 1 {rate.currency_code} = {rate.rate_to_base} PKR",
            ip_address=self.request.META.get('REMOTE_ADDR')
        )

    def perform_update(self, serializer):
        rate = serializer.save(updated_by=self.request.user)
        record_audit_log(
            user=self.request.user,
            action='EXCHANGE_RATE_UPDATED',
            module='SETTINGS',
            entity_id=rate.currency_code,
            description=f"Exchange rate {rate.currency_code} updated: 1 {rate.currency_code} = {rate.rate_to_base} PKR",
            ip_address=self.request.META.get('REMOTE_ADDR')
        )


class CompanyServiceViewSet(viewsets.ModelViewSet):
    """
    CRUD API for Company Services Catalog.
    Safe methods allowed for all authenticated CRM users.
    Create/Update/Delete restricted to Administrators and Sales Managers.
    """
    serializer_class = CompanyServiceSerializer
    permission_classes = [permissions.IsAuthenticated]
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['name', 'description', 'category']
    ordering_fields = ['name', 'default_unit_price', 'created_at']

    def get_queryset(self):
        qs = CompanyService.objects.all()
        active_only = self.request.query_params.get('active_only')
        if active_only and active_only.lower() in ['true', '1']:
            qs = qs.filter(is_active=True)
        category = self.request.query_params.get('category')
        if category:
            qs = qs.filter(category=category)
        return qs.order_by('category', 'name')

    def check_permissions(self, request):
        super().check_permissions(request)
        if request.method not in permissions.SAFE_METHODS:
            user = request.user
            if not (user.is_administrator or user.is_sales_manager):
                self.permission_denied(
                    request,
                    message="Only administrators and sales managers can manage services in the catalog."
                )

    def perform_create(self, serializer):
        svc = serializer.save()
        record_audit_log(
            user=self.request.user,
            action='SERVICE_CREATED',
            module='SERVICES',
            entity_id=str(svc.id),
            description=f"Service '{svc.name}' added to catalog ({svc.currency} {svc.default_unit_price})",
            ip_address=self.request.META.get('REMOTE_ADDR')
        )

    def perform_update(self, serializer):
        svc = serializer.save()
        record_audit_log(
            user=self.request.user,
            action='SERVICE_UPDATED',
            module='SERVICES',
            entity_id=str(svc.id),
            description=f"Service '{svc.name}' updated",
            ip_address=self.request.META.get('REMOTE_ADDR')
        )

    def perform_destroy(self, instance):
        name = instance.name
        svc_id = str(instance.id)
        instance.delete()
        record_audit_log(
            user=self.request.user,
            action='SERVICE_DELETED',
            module='SERVICES',
            entity_id=svc_id,
            description=f"Service '{name}' removed from catalog",
            ip_address=self.request.META.get('REMOTE_ADDR')
        )


def health_check(request):
    from django.http import JsonResponse
    from django.db import connection
    try:
        connection.cursor()
        db_status = "healthy"
    except Exception:
        db_status = "unhealthy"

    return JsonResponse({
        "status": "healthy" if db_status == "healthy" else "degraded",
        "service": "Root4Tech Smart CRM API",
        "version": "3.0.0",
        "database": db_status
    }, status=200 if db_status == "healthy" else 503)

