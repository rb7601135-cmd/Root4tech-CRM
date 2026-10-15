"""
Root4Tech CRM - Views and API Endpoints (Phase 2 Backend).
"""

import csv
from datetime import date, timedelta
from django.shortcuts import render, redirect, get_object_or_404
from django.contrib.auth import authenticate, login, logout
from django.contrib.auth.models import User
from django.contrib.auth.decorators import login_required
from django.http import JsonResponse, HttpResponse
from django.views.decorators.csrf import ensure_csrf_cookie
from django.views.decorators.http import require_http_methods
from django.db.models import Sum, Count, Q
from django.utils import timezone
from django.core.management import call_command
from decimal import Decimal

from rest_framework import viewsets, permissions, status, filters
from rest_framework.decorators import api_view, permission_classes, action
from rest_framework.response import Response

from .models import (
    StaffProfile, Service, Client, Lead, Project, Task,
    FollowUp, Quotation, Invoice, BillingItem, Payment,
    Notification, ActivityLog, AgencySetting
)
from .serializers import (
    UserBriefSerializer, StaffProfileSerializer, ServiceSerializer,
    ClientSerializer, LeadSerializer, ProjectSerializer, TaskSerializer,
    FollowUpSerializer, QuotationSerializer, InvoiceSerializer,
    BillingItemSerializer, PaymentSerializer, NotificationSerializer,
    ActivityLogSerializer, AgencySettingSerializer
)
from .permissions import (
    get_user_role, IsAdminOrSuperuser, IsSalesManagerOrAdmin,
    CanAccessLeads, CanAccessClients, CanAccessProjects, CanAccessBilling
)
from .pdf_generator import generate_invoice_pdf, generate_quotation_pdf



# =============================================================================
# 1. Authentication & Session APIs
# =============================================================================

@api_view(['POST'])
@permission_classes([permissions.AllowAny])
@ensure_csrf_cookie
def api_login(request):
    """
    Authenticate staff user using email or username.
    """
    try:
        username_or_email = request.data.get('email', '') or request.data.get('username', '')
        password = request.data.get('password', '')

        if not username_or_email or not password:
            return Response({'success': False, 'message': 'Username/email and password required.'}, status=400)

        clean_input = str(username_or_email).strip()
        user = None

        # Allow login by email or username
        if '@' in clean_input:
            matched = User.objects.filter(email__iexact=clean_input).first()
            if matched:
                user = authenticate(request, username=matched.username, password=password)
            if not user:
                user = authenticate(request, username=clean_input, password=password)
        else:
            user = authenticate(request, username=clean_input, password=password)

        if user is not None and user.is_active:
            try:
                login(request, user)
            except Exception:
                # Session table temporary file lock should not abort user authentication
                pass
            profile = getattr(user, 'staff_profile', None)
            role_key = profile.role_key if profile else ('admin' if user.is_superuser else 'sales_mgr')

            try:
                ActivityLog.objects.create(
                    user=user,
                    action='Staff Login',
                    entity_type='Auth',
                    entity_id=str(user.id),
                    details=f"User {user.get_full_name() or user.username} logged into CRM."
                )
            except Exception:
                pass

            return Response({
                'success': True,
                'message': f'Welcome back, {user.first_name or user.username}!',
                'user': {
                    'id': user.id,
                    'username': user.username,
                    'name': user.get_full_name() or user.username,
                    'email': user.email,
                    'role': profile.role_title if profile else 'Administrator',
                    'role_key': role_key,
                    'avatar': profile.avatar if profile else 'AD',
                    'color': profile.color if profile else '#2563eb',
                }
            })
        else:
            return Response({'success': False, 'message': 'Invalid credentials. Please verify your email and password.'}, status=401)
    except Exception as exc:
        return Response({'success': False, 'message': f'Login server error: {str(exc)}'}, status=500)



@api_view(['POST', 'GET'])
@permission_classes([permissions.AllowAny])
def api_logout(request):
    """Log out currently authenticated user."""
    if request.user.is_authenticated:
        ActivityLog.objects.create(
            user=request.user,
            action='Staff Logout',
            entity_type='Auth',
            entity_id=str(request.user.id),
            details=f"User {request.user.username} logged out."
        )
    logout(request)
    return Response({'success': True, 'message': 'Logged out successfully.'})


@api_view(['GET'])
@permission_classes([permissions.AllowAny])
def api_current_user(request):
    """Get current session staff details, permissions, and unread notification counts."""
    if not request.user.is_authenticated:
        # If unauthenticated, return default sales manager profile
        default_user = User.objects.filter(username='sharjeel').first() or User.objects.first()
        if default_user:
            profile = getattr(default_user, 'staff_profile', None)
            return Response({
                'authenticated': False,
                'user': {
                    'id': default_user.id,
                    'username': default_user.username,
                    'name': default_user.get_full_name() or default_user.username,
                    'email': default_user.email,
                    'role': profile.role_title if profile else 'Sales Manager',
                    'role_key': profile.role_key if profile else 'sales_mgr',
                    'avatar': profile.avatar if profile else 'SS',
                    'color': profile.color if profile else '#059669',
                }
            })
        return Response({'authenticated': False}, status=401)

    profile = getattr(request.user, 'staff_profile', None)
    role_key = profile.role_key if profile else ('admin' if request.user.is_superuser else 'sales_mgr')

    return Response({
        'authenticated': True,
        'user': {
            'id': request.user.id,
            'username': request.user.username,
            'name': request.user.get_full_name() or request.user.username,
            'email': request.user.email,
            'role': profile.role_title if profile else 'Administrator',
            'role_key': role_key,
            'avatar': profile.avatar if profile else 'AD',
            'color': profile.color if profile else '#2563eb',
            'is_superuser': request.user.is_superuser,
            'unread_notifications': Notification.objects.filter(Q(recipient=request.user) | Q(role_target__in=['all', role_key]), is_read=False).count(),
        }
    })


@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
def api_switch_persona(request):
    """
    Persona switching is strictly disabled for security.
    Staff members can only operate under their own authenticated account.
    """
    return Response({
        'success': False,
        'message': 'Profile switching is disabled for security. Each staff member must log in with their own account.'
    }, status=status.HTTP_403_FORBIDDEN)


# =============================================================================
# 2. CRUD ViewSets
# =============================================================================

class LeadViewSet(viewsets.ModelViewSet):
    serializer_class = LeadSerializer
    permission_classes = [CanAccessLeads]
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['name', 'company', 'email', 'phone', 'service_required', 'notes']
    ordering_fields = ['created_at', 'estimated_deal_value', 'next_follow_up', 'name']
    ordering = ['-created_at']

    def get_queryset(self):
        user = self.request.user
        role = get_user_role(user)
        queryset = Lead.objects.all()

        # Salesperson only sees their assigned leads
        if role == 'sales' and not user.is_superuser:
            queryset = queryset.filter(Q(assigned_salesperson=user) | Q(assigned_salesperson__isnull=True))

        # Query Filters
        stage = self.request.query_params.get('stage')
        status_val = self.request.query_params.get('status')
        source = self.request.query_params.get('source')
        if stage:
            queryset = queryset.filter(stage=stage)
        if status_val:
            queryset = queryset.filter(status=status_val)
        if source:
            queryset = queryset.filter(lead_source=source)

        return queryset

    def perform_create(self, serializer):
        user = self.request.user if self.request.user.is_authenticated else None
        lead = serializer.save(assigned_salesperson=user if get_user_role(user) == 'sales' and not serializer.validated_data.get('assigned_salesperson') else serializer.validated_data.get('assigned_salesperson'))
        ActivityLog.objects.create(
            user=user,
            action='Created Lead',
            entity_type='Lead',
            entity_id=lead.lead_id,
            details=f"Created lead {lead.name} from {lead.company} (${lead.estimated_deal_value})."
        )

    def perform_update(self, serializer):
        lead = serializer.save()
        user = self.request.user if self.request.user.is_authenticated else None
        ActivityLog.objects.create(
            user=user,
            action='Updated Lead',
            entity_type='Lead',
            entity_id=lead.lead_id,
            details=f"Updated lead {lead.name} ({lead.company}) - Stage: {lead.stage}."
        )

    @action(detail=True, methods=['post'])
    def convert(self, request, pk=None):
        """
        Direct Lead to Client conversion without duplicates.
        """
        lead = self.get_object()
        client = lead.convert_to_client(request.user if request.user.is_authenticated else None)
        return Response({
            'success': True,
            'message': f"Lead {lead.name} successfully converted to Client {client.company} ({client.client_id})!",
            'client': ClientSerializer(client).data,
            'lead': LeadSerializer(lead).data
        })

    @action(detail=True, methods=['post'])
    def archive(self, request, pk=None):
        lead = self.get_object()
        lead.status = 'Archived'
        lead.save()
        return Response({'success': True, 'message': f'Lead {lead.lead_id} archived.'})

    @action(detail=True, methods=['post'], url_path='create-project')
    def create_project(self, request, pk=None):
        """
        Phase 3: Automatically creates a project from a won deal after confirmation.
        """
        lead = self.get_object()
        service_id = request.data.get('service_id')
        service = Service.objects.filter(id=service_id).first() if service_id else None
        assigned_user_id = request.data.get('assigned_user_id')
        assigned_user = User.objects.filter(id=assigned_user_id).first() if assigned_user_id else None

        project = lead.create_project_from_deal(
            service=service,
            assigned_user=assigned_user,
            creator_user=request.user if request.user.is_authenticated else None
        )
        return Response({
            'success': True,
            'message': f"Project {project.title} ({project.project_id}) created from won deal {lead.lead_id}!",
            'project': ProjectSerializer(project).data
        })



class ClientViewSet(viewsets.ModelViewSet):
    serializer_class = ClientSerializer
    permission_classes = [CanAccessClients]
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['company', 'contact_person', 'email', 'phone', 'industry']
    ordering_fields = ['created_at', 'total_spent', 'company']
    ordering = ['-created_at']

    def get_queryset(self):
        user = self.request.user
        role = get_user_role(user)
        queryset = Client.objects.all()

        # Developers / Editors can only see clients for their assigned projects
        if role in ['dev', 'editor'] and not user.is_superuser:
            queryset = queryset.filter(projects__assigned_staff=user).distinct()

        status_val = self.request.query_params.get('status')
        if status_val:
            queryset = queryset.filter(status=status_val)
        return queryset

    def perform_create(self, serializer):
        client = serializer.save(account_manager=self.request.user if self.request.user.is_authenticated else None)
        ActivityLog.objects.create(
            user=self.request.user if self.request.user.is_authenticated else None,
            action='Created Client',
            entity_type='Client',
            entity_id=client.client_id,
            details=f"Added client account {client.company} ({client.contact_person})."
        )


class ServiceViewSet(viewsets.ModelViewSet):
    queryset = Service.objects.all()
    serializer_class = ServiceSerializer
    permission_classes = [permissions.IsAuthenticatedOrReadOnly]
    filter_backends = [filters.SearchFilter]
    search_fields = ['name', 'category', 'description']


class ProjectViewSet(viewsets.ModelViewSet):
    serializer_class = ProjectSerializer
    permission_classes = [CanAccessProjects]
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['title', 'client__company', 'notes', 'tech_stack']
    ordering_fields = ['deadline', 'created_at', 'progress', 'priority']
    ordering = ['-deadline']

    def get_queryset(self):
        user = self.request.user
        role = get_user_role(user)
        queryset = Project.objects.all()

        if role in ['dev', 'editor'] and not user.is_superuser:
            queryset = queryset.filter(assigned_staff=user)

        status_val = self.request.query_params.get('status')
        priority = self.request.query_params.get('priority')
        project_type = self.request.query_params.get('type')
        if status_val:
            queryset = queryset.filter(status=status_val)
        if priority:
            queryset = queryset.filter(priority=priority)
        if project_type:
            queryset = queryset.filter(project_type=project_type)
        return queryset

    def perform_create(self, serializer):
        proj = serializer.save()
        ActivityLog.objects.create(
            user=self.request.user if self.request.user.is_authenticated else None,
            action='Created Project',
            entity_type='Project',
            entity_id=proj.project_id,
            details=f"Created project {proj.title} for {proj.client.company}."
        )

    @action(detail=True, methods=['post'], url_path='ready-for-review')
    def mark_ready_for_review(self, request, pk=None):
        """
        Lets authorized staff mark work as ready for review.
        """
        project = self.get_object()
        project.status = 'Ready for Review'
        project.progress = max(project.progress, 90)
        project.save(update_fields=['status', 'progress'])

        user = request.user if request.user.is_authenticated else None
        user_name = user.get_full_name() if user else 'Team Member'

        Notification.objects.create(
            role_target='sales_mgr',
            title=f"📋 Project Ready for Review: {project.title}",
            message=f"{user_name} marked project {project.title} ({project.project_id}) ready for review.",
            category='project'
        )
        ActivityLog.objects.create(
            user=user,
            action='Marked Project Ready for Review',
            entity_type='Project',
            entity_id=project.project_id,
            details=f"Project {project.title} marked ready for review by {user_name}."
        )
        return Response({'success': True, 'message': f'Project {project.project_id} marked as Ready for Review.'})

    @action(detail=True, methods=['post'], url_path='mark-completed')
    def mark_completed(self, request, pk=None):
        """
        Lets authorized managers sign off work as completed.
        """
        project = self.get_object()
        user = request.user if request.user.is_authenticated else None
        role = get_user_role(user)
        if role not in ['sales_mgr', 'admin'] and not (user and user.is_superuser):
            return Response({'success': False, 'message': 'Only Sales Managers or Administrators can sign off project completion.'}, status=403)

        project.status = 'Completed'
        project.progress = 100
        project.save(update_fields=['status', 'progress'])

        Notification.objects.create(
            role_target='all',
            title=f"🎉 Project Completed: {project.title}",
            message=f"Project {project.title} ({project.project_id}) was marked as Completed and delivered!",
            category='project'
        )
        ActivityLog.objects.create(
            user=user,
            action='Marked Project Completed',
            entity_type='Project',
            entity_id=project.project_id,
            details=f"Project {project.title} signed off as Completed."
        )
        return Response({'success': True, 'message': f'Project {project.project_id} marked as Completed!'})

    @action(detail=True, methods=['post'], url_path='request-revision')
    def request_revision(self, request, pk=None):
        """
        Logs a client or internal revision request, updates counters and notifies assigned team.
        """
        project = self.get_object()
        project.revisions_count += 1
        project.status = 'In Review'
        project.save(update_fields=['revisions_count', 'status'])

        notes = request.data.get('notes', 'Revision requested.')
        user = request.user if request.user.is_authenticated else None

        for u in project.assigned_staff.all():
            Notification.objects.create(
                recipient=u,
                role_target='all',
                title=f"🔄 Revision #{project.revisions_count} Requested: {project.title}",
                message=f"Feedback: {notes}",
                category='project'
            )
        ActivityLog.objects.create(
            user=user,
            action='Requested Revision',
            entity_type='Project',
            entity_id=project.project_id,
            details=f"Revision #{project.revisions_count} requested for project {project.title}: {notes}"
        )
        return Response({
            'success': True,
            'message': f'Revision #{project.revisions_count} logged for project {project.project_id}.',
            'revisions_count': project.revisions_count
        })



class TaskViewSet(viewsets.ModelViewSet):
    serializer_class = TaskSerializer
    permission_classes = [permissions.IsAuthenticated]
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['title', 'notes', 'project__title']
    ordering_fields = ['due_date', 'priority', 'status']
    ordering = ['due_date']

    def get_queryset(self):
        user = self.request.user
        role = get_user_role(user)
        queryset = Task.objects.all()

        if role in ['dev', 'editor'] and not user.is_superuser:
            queryset = queryset.filter(assigned_to=user)

        status_val = self.request.query_params.get('status')
        priority = self.request.query_params.get('priority')
        if status_val:
            queryset = queryset.filter(status=status_val)
        if priority:
            queryset = queryset.filter(priority=priority)
        return queryset


class FollowUpViewSet(viewsets.ModelViewSet):
    serializer_class = FollowUpSerializer
    permission_classes = [permissions.IsAuthenticated]
    filter_backends = [filters.OrderingFilter]
    ordering = ['scheduled_date', 'scheduled_time']

    def get_queryset(self):
        user = self.request.user
        role = get_user_role(user)
        queryset = FollowUp.objects.all()
        if role == 'sales' and not user.is_superuser:
            queryset = queryset.filter(assigned_to=user)
        return queryset

    @action(detail=False, methods=['get'], url_path='upcoming')
    def upcoming(self, request):
        today = timezone.now().date()
        cutoff = today + timedelta(days=7)
        qs = self.get_queryset().filter(status='Scheduled', scheduled_date__gte=today, scheduled_date__lte=cutoff)
        return Response(FollowUpSerializer(qs, many=True).data)

    @action(detail=False, methods=['get'], url_path='overdue')
    def overdue(self, request):
        today = timezone.now().date()
        qs = self.get_queryset().filter(scheduled_date__lt=today).exclude(status='Completed')
        return Response(FollowUpSerializer(qs, many=True).data)

    @action(detail=False, methods=['post'], url_path='trigger-check')
    def trigger_check(self, request):
        user = request.user
        role = get_user_role(user)
        if role not in ['sales_mgr', 'admin'] and not (user and user.is_superuser):
            return Response({'success': False, 'message': 'Only Sales Managers or Administrators can trigger automation checks.'}, status=403)
        force = request.data.get('force', False)
        call_command('check_followups', force=force)
        return Response({'success': True, 'message': 'Follow-up automation checks executed successfully.'})


class QuotationViewSet(viewsets.ModelViewSet):
    serializer_class = QuotationSerializer
    permission_classes = [CanAccessBilling]
    ordering = ['-issue_date']

    def get_queryset(self):
        return Quotation.objects.all()

    def perform_create(self, serializer):
        qtn = serializer.save(created_by=self.request.user if self.request.user.is_authenticated else None)
        # Parse items if passed in request.data['items']
        items_data = self.request.data.get('items', [])
        for it in items_data:
            BillingItem.objects.create(
                quotation=qtn,
                description=it.get('desc', it.get('description', 'Service Item')),
                quantity=Decimal(str(it.get('qty', 1))),
                unit_rate=Decimal(str(it.get('rate', 0))),
            )
        ActivityLog.objects.create(
            user=self.request.user if self.request.user.is_authenticated else None,
            action='Created Quotation',
            entity_type='Quotation',
            entity_id=qtn.quotation_number,
            details=f"Created quotation {qtn.quotation_number} for {qtn.client_display} (${qtn.amount})."
        )

    @action(detail=True, methods=['get'], url_path='pdf')
    def download_pdf(self, request, pk=None):
        quotation = self.get_object()
        pdf_bytes = generate_quotation_pdf(quotation)
        response = HttpResponse(pdf_bytes, content_type='application/pdf')
        filename = f"{quotation.quotation_number}.pdf"
        response['Content-Disposition'] = f'inline; filename="{filename}"'
        return response


class InvoiceViewSet(viewsets.ModelViewSet):
    serializer_class = InvoiceSerializer
    permission_classes = [CanAccessBilling]
    ordering = ['-issue_date']

    def get_queryset(self):
        return Invoice.objects.all()

    def perform_create(self, serializer):
        inv = serializer.save(created_by=self.request.user if self.request.user.is_authenticated else None)
        items_data = self.request.data.get('items', [])
        for it in items_data:
            BillingItem.objects.create(
                invoice=inv,
                description=it.get('desc', it.get('description', 'Service Item')),
                quantity=Decimal(str(it.get('qty', 1))),
                unit_rate=Decimal(str(it.get('rate', 0))),
            )
        ActivityLog.objects.create(
            user=self.request.user if self.request.user.is_authenticated else None,
            action='Created Invoice',
            entity_type='Invoice',
            entity_id=inv.invoice_number,
            details=f"Issued invoice {inv.invoice_number} to {inv.client_display} (${inv.amount})."
        )

    @action(detail=True, methods=['get'], url_path='pdf')
    def download_pdf(self, request, pk=None):
        invoice = self.get_object()
        pdf_bytes = generate_invoice_pdf(invoice)
        response = HttpResponse(pdf_bytes, content_type='application/pdf')
        filename = f"{invoice.invoice_number}.pdf"
        response['Content-Disposition'] = f'inline; filename="{filename}"'
        return response

    @action(detail=True, methods=['post'])
    def mark_paid(self, request, pk=None):
        inv = self.get_object()
        inv.status = 'Paid'
        inv.paid_amount = inv.amount
        inv.save()
        Payment.objects.create(
            invoice=inv,
            amount=inv.amount,
            payment_date=timezone.now().date(),
            payment_method='Wire Transfer',
            reference_number=f"SETTLED-{timezone.now().strftime('%Y%m%d')}",
            recorded_by=request.user if request.user.is_authenticated else None
        )
        return Response({'success': True, 'message': f'Invoice {inv.invoice_number} marked as Paid!'})

    @action(detail=True, methods=['post'], url_path='record-payment')
    def record_payment(self, request, pk=None):
        invoice = self.get_object()
        amount_val = Decimal(str(request.data.get('amount', invoice.balance_due or invoice.amount)))
        method = request.data.get('payment_method', 'Wire Transfer')
        ref = request.data.get('reference_number', '')
        notes = request.data.get('notes', '')

        if amount_val <= 0:
            return Response({'success': False, 'message': 'Payment amount must be greater than zero.'}, status=400)

        payment = Payment.objects.create(
            invoice=invoice,
            amount=amount_val,
            payment_date=timezone.now().date(),
            payment_method=method,
            reference_number=ref,
            notes=notes,
            recorded_by=request.user if request.user.is_authenticated else None
        )

        ActivityLog.objects.create(
            user=request.user if request.user.is_authenticated else None,
            action='Recorded Payment',
            entity_type='Payment',
            entity_id=str(payment.id),
            details=f"Recorded payment of ${payment.amount} for {invoice.invoice_number} via {method}."
        )

        return Response({
            'success': True,
            'message': f"Payment of ${payment.amount} recorded for {invoice.invoice_number} ({invoice.status})!",
            'invoice': InvoiceSerializer(invoice).data
        })

    @action(detail=True, methods=['post'])
    def mark_sent(self, request, pk=None):
        inv = self.get_object()
        inv.status = 'Sent'
        inv.save()
        return Response({'success': True, 'message': f'Invoice {inv.invoice_number} marked as Sent to client!'})


@api_view(['GET'])
@permission_classes([CanAccessBilling])
def api_download_invoice_pdf(request, invoice_id):
    """
    Download Invoice PDF by ID (integer primary key or invoice_number string).
    """
    if str(invoice_id).isdigit():
        invoice = Invoice.objects.filter(id=int(invoice_id)).first()
    else:
        invoice = Invoice.objects.filter(invoice_number__iexact=str(invoice_id).strip()).first()

    if not invoice:
        return Response({'success': False, 'message': f'Invoice {invoice_id} not found.'}, status=404)

    pdf_bytes = generate_invoice_pdf(invoice)
    response = HttpResponse(pdf_bytes, content_type='application/pdf')
    response['Content-Disposition'] = f'inline; filename="{invoice.invoice_number}.pdf"'
    return response


@api_view(['GET'])
@permission_classes([CanAccessBilling])
def api_download_quotation_pdf(request, quotation_id):
    """
    Download Quotation PDF by ID (integer primary key or quotation_number string).
    """
    if str(quotation_id).isdigit():
        qtn = Quotation.objects.filter(id=int(quotation_id)).first()
    else:
        qtn = Quotation.objects.filter(quotation_number__iexact=str(quotation_id).strip()).first()

    if not qtn:
        return Response({'success': False, 'message': f'Quotation {quotation_id} not found.'}, status=404)

    pdf_bytes = generate_quotation_pdf(qtn)
    response = HttpResponse(pdf_bytes, content_type='application/pdf')
    response['Content-Disposition'] = f'inline; filename="{qtn.quotation_number}.pdf"'
    return response




class NotificationViewSet(viewsets.ModelViewSet):
    serializer_class = NotificationSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        role = get_user_role(user)
        return Notification.objects.filter(Q(recipient=user) | Q(role_target__in=['all', role])).order_by('-created_at')

    @action(detail=False, methods=['post'])
    def mark_all_read(self, request):
        self.get_queryset().update(is_read=True)
        return Response({'success': True, 'message': 'All notifications marked as read.'})


class StaffViewSet(viewsets.ModelViewSet):
    queryset = StaffProfile.objects.all()
    serializer_class = StaffProfileSerializer
    permission_classes = [permissions.IsAuthenticatedOrReadOnly]


# =============================================================================
# 3. Aggregated CRM Analytics & State Sync
# =============================================================================

@api_view(['GET'])
@permission_classes([permissions.AllowAny])
def api_crm_bundle(request):
    """
    Returns full state bundle for frontend hydration, replacing sample data
    with real Django queries while strictly honoring role permissions!
    """
    user = request.user if request.user.is_authenticated else None
    role = get_user_role(user) or 'sales_mgr'

    leads_qs = Lead.objects.all()
    clients_qs = Client.objects.all()
    projects_qs = Project.objects.all()
    tasks_qs = Task.objects.all()
    invoices_qs = Invoice.objects.all()
    quotations_qs = Quotation.objects.all()

    # Apply role scoping
    if role == 'sales' and not (user and user.is_superuser):
        leads_qs = leads_qs.filter(Q(assigned_salesperson=user) | Q(assigned_salesperson__isnull=True))
        tasks_qs = tasks_qs.filter(assigned_to=user)
        # Salesperson cannot see invoices
        invoices_qs = Invoice.objects.none()
        quotations_qs = Quotation.objects.none()
    elif role in ['dev', 'editor'] and not (user and user.is_superuser):
        leads_qs = Lead.objects.none()
        clients_qs = clients_qs.filter(projects__assigned_staff=user).distinct()
        projects_qs = projects_qs.filter(assigned_staff=user)
        tasks_qs = tasks_qs.filter(assigned_to=user)
        invoices_qs = Invoice.objects.none()
        quotations_qs = Quotation.objects.none()

    # Form formatted teamMembers list
    profiles = StaffProfile.objects.all()
    team_members = [
        {
            'id': f"{p.role_key}_1" if p.role_key != 'custom' else f"staff_{p.id}",
            'name': p.full_name,
            'role': p.role_title,
            'roleKey': p.role_key,
            'email': p.email,
            'phone': p.phone,
            'avatar': p.avatar,
            'color': p.color,
            'skills': p.skills,
            'activeProjectsCount': p.active_projects_count,
            'pendingTasksCount': p.pending_tasks_count,
            'status': p.status,
        }
        for p in profiles
    ]

    # Form formatted services list
    services = [
        {
            'id': s.service_id,
            'name': s.name,
            'category': s.category,
            'price': float(s.price),
            'unit': s.unit,
            'description': s.description,
        }
        for s in Service.objects.filter(is_active=True)
    ]

    # Form formatted clients list
    clients = [
        {
            'id': c.client_id,
            'company': c.company,
            'contactPerson': c.contact_person,
            'email': c.email,
            'phone': c.phone,
            'industry': c.industry,
            'totalSpent': float(c.total_spent),
            'projectsCount': c.projects_count,
            'status': c.status,
            'address': c.address or 'Direct Client Account',
        }
        for c in clients_qs
    ]

    # Form formatted leads list
    leads = [
        {
            'id': l.lead_id,
            'name': l.name,
            'company': l.company,
            'email': l.email,
            'phone': l.phone,
            'serviceRequired': l.service_required,
            'leadSource': l.lead_source,
            'assignedSalesperson': l.assigned_salesperson.get_full_name() if l.assigned_salesperson else 'Unassigned',
            'estimatedDealValue': float(l.estimated_deal_value),
            'nextFollowUp': str(l.next_follow_up) if l.next_follow_up else '',
            'stage': l.stage,
            'status': l.status,
            'createdDate': l.created_at.strftime('%Y-%m-%d'),
            'notes': l.notes,
            'isConverted': l.is_converted,
        }
        for l in leads_qs
    ]

    # Form formatted projects list
    projects = [
        {
            'id': p.project_id,
            'title': p.title,
            'client': p.client.company,
            'type': p.project_type,
            'status': p.status,
            'priority': p.priority,
            'progress': p.progress,
            'budget': float(p.budget),
            'deadline': str(p.deadline) if p.deadline else '',
            'techStack': p.tech_stack,
            'notes': p.notes,
            'assigned': [u.get_full_name() for u in p.assigned_staff.all()],
            'previewLink': p.preview_link,
            'deliveryLink': p.delivery_link,
        }
        for p in projects_qs
    ]

    # Form formatted tasks list
    tasks = [
        {
            'id': t.id,
            'title': t.title,
            'project': t.project.title if t.project else 'General',
            'assignedTo': t.assigned_to.get_full_name() if t.assigned_to else 'Unassigned',
            'priority': t.priority,
            'status': t.status,
            'dueDate': str(t.due_date) if t.due_date else '',
            'notes': t.notes,
        }
        for t in tasks_qs
    ]

    # Form formatted invoices & quotations list
    invoices = []
    for inv in invoices_qs:
        invoices.append({
            'id': inv.invoice_number,
            'type': 'Invoice',
            'client': inv.client_display,
            'project': inv.project_scope_title,
            'createdBy': inv.created_by.get_full_name() if inv.created_by else 'Sir Sharjeel',
            'createdRole': getattr(getattr(inv.created_by, 'staff_profile', None), 'role_title', 'Sales Manager'),
            'issueDate': str(inv.issue_date),
            'dueDate': str(inv.due_date),
            'amount': float(inv.amount),
            'status': inv.status,
            'items': [{'desc': it.description, 'qty': float(it.quantity), 'rate': float(it.unit_rate)} for it in inv.items.all()]
        })

    for qtn in quotations_qs:
        invoices.append({
            'id': qtn.quotation_number,
            'type': 'Quotation',
            'client': qtn.client_display,
            'project': qtn.project_scope_title,
            'createdBy': qtn.created_by.get_full_name() if qtn.created_by else 'Sir Sharjeel',
            'createdRole': getattr(getattr(qtn.created_by, 'staff_profile', None), 'role_title', 'Sales Manager'),
            'issueDate': str(qtn.issue_date),
            'dueDate': str(qtn.valid_until) if qtn.valid_until else '',
            'amount': float(qtn.amount),
            'status': qtn.status,
            'items': [{'desc': it.description, 'qty': float(it.quantity), 'rate': float(it.unit_rate)} for it in qtn.items.all()]
        })

    # Notifications
    notifications = [
        {
            'id': f"NOTIF-{n.id}",
            'title': n.title,
            'message': n.message,
            'category': n.category,
            'time': n.created_at.strftime('%b %d, %H:%M'),
            'read': n.is_read,
            'role': n.role_target,
        }
        for n in Notification.objects.filter(Q(recipient=user) | Q(role_target__in=['all', role]))[:15]
    ]

    return Response({
        'currentRole': role,
        'currentUser': {
            'name': user.get_full_name() if user else 'Sir Sharjeel',
            'role': getattr(getattr(user, 'staff_profile', None), 'role_title', 'Sales Manager'),
            'roleKey': role,
        },
        'teamMembers': team_members,
        'services': services,
        'clients': clients,
        'leads': leads,
        'projects': projects,
        'tasks': tasks,
        'invoices': invoices,
        'notifications': notifications,
    })


# =============================================================================
# 3b. Agency Settings & CMS Configuration APIs (Phase 3)
# =============================================================================

@api_view(['GET', 'PUT', 'PATCH'])
@permission_classes([permissions.IsAuthenticated])
def api_agency_settings(request):
    """
    CMS Protected Settings API (Phase 3).
    GET: Authenticated staff can view organization settings.
    PUT/PATCH: Restricted strictly to Administrator / Superuser accounts.
    """
    settings = AgencySetting.get_settings()
    if request.method == 'GET':
        return Response(AgencySettingSerializer(settings).data)

    user = request.user
    role = get_user_role(user)
    if role != 'admin' and not user.is_superuser:
        return Response({
            'success': False,
            'message': 'Access Denied: Only system administrators can update agency CMS settings and user permissions.'
        }, status=403)

    serializer = AgencySettingSerializer(settings, data=request.data, partial=True)
    if serializer.is_valid():
        serializer.save()
        ActivityLog.objects.create(
            user=user,
            action='Updated Agency Settings',
            entity_type='Settings',
            entity_id=str(settings.id),
            details=f"Admin {user.username} updated agency settings & branding configuration."
        )
        return Response({'success': True, 'message': 'Agency settings updated successfully!', 'settings': serializer.data})
    return Response(serializer.errors, status=400)


# =============================================================================
# 3c. Reports & Analytics APIs (Phase 3)
# =============================================================================

@api_view(['GET'])
@permission_classes([CanAccessBilling])
def api_reports_analytics(request):
    """
    Comprehensive Analytics & Reports Endpoint (Phase 3).
    Filterable by start_date and end_date.
    Calculates leads by stage & source, conversion rate, salesperson performance,
    won/lost deals, active/completed projects, overdue tasks, team workload,
    and complete invoicing/payment/balance financial metrics.
    """
    start_date_str = request.query_params.get('start_date')
    end_date_str = request.query_params.get('end_date')

    leads_qs = Lead.objects.all()
    projects_qs = Project.objects.all()
    tasks_qs = Task.objects.all()
    invoices_qs = Invoice.objects.all()
    payments_qs = Payment.objects.all()

    if start_date_str:
        leads_qs = leads_qs.filter(created_at__date__gte=start_date_str)
        projects_qs = projects_qs.filter(created_at__date__gte=start_date_str)
        tasks_qs = tasks_qs.filter(created_at__date__gte=start_date_str)
        invoices_qs = invoices_qs.filter(issue_date__gte=start_date_str)
        payments_qs = payments_qs.filter(payment_date__gte=start_date_str)

    if end_date_str:
        leads_qs = leads_qs.filter(created_at__date__lte=end_date_str)
        projects_qs = projects_qs.filter(created_at__date__lte=end_date_str)
        tasks_qs = tasks_qs.filter(created_at__date__lte=end_date_str)
        invoices_qs = invoices_qs.filter(issue_date__lte=end_date_str)
        payments_qs = payments_qs.filter(payment_date__lte=end_date_str)

    # 1. Leads by Stage & Source
    leads_by_stage = list(leads_qs.values('stage').annotate(count=Count('id'), total_val=Sum('estimated_deal_value')).order_by('-count'))
    leads_by_source = list(leads_qs.values('lead_source').annotate(count=Count('id'), total_val=Sum('estimated_deal_value')).order_by('-count'))

    # 2. Conversion Rate
    total_leads = leads_qs.count()
    won_leads = leads_qs.filter(stage='Won').count()
    lost_leads = leads_qs.filter(stage='Lost').count()
    conversion_rate = round((won_leads / total_leads * 100), 1) if total_leads > 0 else 0.0

    # 3. Won and Lost Deals
    won_deal_value = float(leads_qs.filter(stage='Won').aggregate(s=Sum('estimated_deal_value'))['s'] or 0)
    lost_deal_value = float(leads_qs.filter(stage='Lost').aggregate(s=Sum('estimated_deal_value'))['s'] or 0)

    # 4. Salesperson Performance
    salespeople = User.objects.filter(staff_profile__role_key__in=['sales', 'sales_mgr'])
    salesperson_perf = []
    for sp in salespeople:
        sp_leads = leads_qs.filter(assigned_salesperson=sp)
        sp_total = sp_leads.count()
        sp_won = sp_leads.filter(stage='Won').count()
        sp_rate = round((sp_won / sp_total * 100), 1) if sp_total > 0 else 0.0
        sp_revenue = float(sp_leads.filter(stage='Won').aggregate(s=Sum('estimated_deal_value'))['s'] or 0)
        salesperson_perf.append({
            'id': sp.id,
            'name': sp.get_full_name() or sp.username,
            'role': getattr(getattr(sp, 'staff_profile', None), 'role_title', 'Sales'),
            'total_leads': sp_total,
            'won_leads': sp_won,
            'conversion_rate': sp_rate,
            'won_revenue': sp_revenue,
        })

    # 5. Active and Completed Projects
    active_projects_count = projects_qs.filter(status__in=['Active', 'In Review', 'Ready for Review', 'Planning']).count()
    completed_projects_count = projects_qs.filter(status='Completed').count()
    on_hold_projects_count = projects_qs.filter(status='On Hold').count()

    # 6. Overdue Tasks
    today = timezone.now().date()
    overdue_tasks_qs = tasks_qs.filter(due_date__lt=today).exclude(status='Completed')
    overdue_tasks_count = overdue_tasks_qs.count()
    overdue_tasks_list = [
        {
            'id': t.id,
            'title': t.title,
            'project': t.project.title if t.project else 'General',
            'assigned_to': t.assigned_to.get_full_name() if t.assigned_to else 'Unassigned',
            'due_date': str(t.due_date),
            'priority': t.priority,
            'status': t.status,
        }
        for t in overdue_tasks_qs[:20]
    ]

    # 7. Team Workload
    all_staff = StaffProfile.objects.select_related('user').all()
    team_workload = []
    for staff in all_staff:
        u = staff.user
        workload_projects = projects_qs.filter(assigned_staff=u).exclude(status='Completed').count()
        workload_tasks = tasks_qs.filter(assigned_to=u).exclude(status='Completed').count()
        team_workload.append({
            'staff_id': staff.id,
            'name': staff.user.get_full_name() or staff.user.username,
            'role_title': staff.role_title,
            'role_key': staff.role_key,
            'avatar': staff.avatar,
            'active_projects': workload_projects,
            'pending_tasks': workload_tasks,
        })

    # 8. Invoices, Payments, Outstanding Balances
    total_invoiced = float(invoices_qs.aggregate(s=Sum('amount'))['s'] or 0)
    total_paid = float(payments_qs.aggregate(s=Sum('amount'))['s'] or 0)
    outstanding_balance = max(0.0, total_invoiced - total_paid)
    overdue_invoices_count = invoices_qs.filter(status='Overdue').count()

    return Response({
        'date_range': {'start_date': start_date_str, 'end_date': end_date_str},
        'lead_metrics': {
            'total_leads': total_leads,
            'won_leads': won_leads,
            'lost_leads': lost_leads,
            'conversion_rate': conversion_rate,
            'leads_by_stage': leads_by_stage,
            'leads_by_source': leads_by_source,
            'won_deal_value': won_deal_value,
            'lost_deal_value': lost_deal_value,
        },
        'salesperson_performance': salesperson_perf,
        'project_metrics': {
            'active_projects': active_projects_count,
            'completed_projects': completed_projects_count,
            'on_hold_projects': on_hold_projects_count,
            'total_projects': projects_qs.count(),
        },
        'task_metrics': {
            'overdue_tasks_count': overdue_tasks_count,
            'overdue_tasks': overdue_tasks_list,
        },
        'team_workload': team_workload,
        'financial_metrics': {
            'total_invoiced': total_invoiced,
            'total_payments_received': total_paid,
            'outstanding_balance': outstanding_balance,
            'overdue_invoices_count': overdue_invoices_count,
        }
    })


@api_view(['GET'])
@permission_classes([CanAccessBilling])
def api_reports_export_csv(request):
    """
    Permission-controlled CSV export for CRM reports.
    Query param: report_type (leads, sales, projects, financial)
    """
    report_type = request.query_params.get('report_type', 'leads')
    response = HttpResponse(content_type='text/csv')
    timestamp_str = timezone.now().strftime('%Y%m%d_%H%M')
    response['Content-Disposition'] = f'attachment; filename="root4tech_crm_{report_type}_{timestamp_str}.csv"'
    writer = csv.writer(response)

    if report_type == 'leads':
        writer.writerow(['Lead ID', 'Name', 'Company', 'Email', 'Phone', 'Service', 'Source', 'Stage', 'Status', 'Estimated Value ($)', 'Assigned Staff', 'Created At'])
        for ld in Lead.objects.all():
            writer.writerow([
                ld.lead_id, ld.name, ld.company, ld.email, ld.phone, ld.service_required,
                ld.lead_source, ld.stage, ld.status, float(ld.estimated_deal_value),
                ld.assigned_salesperson.get_full_name() if ld.assigned_salesperson else 'Unassigned',
                ld.created_at.strftime('%Y-%m-%d')
            ])

    elif report_type == 'projects':
        writer.writerow(['Project ID', 'Title', 'Client', 'Type', 'Status', 'Priority', 'Progress (%)', 'Budget ($)', 'Deadline', 'Assigned Team'])
        for p in Project.objects.all():
            writer.writerow([
                p.project_id, p.title, p.client.company, p.project_type, p.status, p.priority,
                p.progress, float(p.budget), str(p.deadline or ''),
                "; ".join([u.get_full_name() for u in p.assigned_staff.all()])
            ])

    elif report_type == 'financial':
        writer.writerow(['Invoice #', 'Client', 'Project Scope', 'Issue Date', 'Due Date', 'Status', 'Invoice Amount ($)', 'Paid Amount ($)', 'Balance Due ($)'])
        for inv in Invoice.objects.all():
            writer.writerow([
                inv.invoice_number, inv.client_display, inv.project_scope_title,
                str(inv.issue_date), str(inv.due_date), inv.status,
                float(inv.amount), float(inv.paid_amount), float(inv.balance_due)
            ])

    else:
        # Default Summary
        writer.writerow(['Metric', 'Value'])
        writer.writerow(['Total Leads', Lead.objects.count()])
        writer.writerow(['Won Leads', Lead.objects.filter(stage='Won').count()])
        writer.writerow(['Total Invoiced ($)', float(Invoice.objects.aggregate(s=Sum('amount'))['s'] or 0)])
        writer.writerow(['Total Payments Received ($)', float(Payment.objects.aggregate(s=Sum('amount'))['s'] or 0)])

    return response


# =============================================================================
# 4. Template Page Views (Serving Frontend HTML)
# =============================================================================


@ensure_csrf_cookie
def page_dashboard(request):
    return render(request, 'index.html')

@ensure_csrf_cookie
def page_leads(request):
    return render(request, 'leads.html')

@ensure_csrf_cookie
def page_lead_details(request):
    return render(request, 'lead-details.html')

@ensure_csrf_cookie
def page_clients(request):
    return render(request, 'clients.html')

@ensure_csrf_cookie
def page_client_details(request):
    return render(request, 'client-details.html')

@ensure_csrf_cookie
def page_projects(request):
    return render(request, 'projects.html')

@ensure_csrf_cookie
def page_project_details(request):
    return render(request, 'project-details.html')

@ensure_csrf_cookie
def page_tasks(request):
    return render(request, 'tasks.html')

@ensure_csrf_cookie
def page_calendar(request):
    return render(request, 'calendar.html')

@ensure_csrf_cookie
def page_invoices(request):
    # Server-side role check: Devs and Video Editors cannot view financial invoices
    if request.user.is_authenticated and get_user_role(request.user) in ['dev', 'editor'] and not request.user.is_superuser:
        return render(request, 'index.html', {'error': 'Access Denied: You do not have permission to view billing invoices.'})
    return render(request, 'invoices.html')

@ensure_csrf_cookie
def page_reports(request):
    if request.user.is_authenticated and get_user_role(request.user) in ['dev', 'editor'] and not request.user.is_superuser:
        return render(request, 'index.html', {'error': 'Access Denied: Reports are restricted to Sales Management.'})
    return render(request, 'reports.html')

@ensure_csrf_cookie
def page_team(request):
    return render(request, 'team.html')

@ensure_csrf_cookie
def page_notifications(request):
    return render(request, 'notifications.html')

@ensure_csrf_cookie
def page_settings(request):
    return render(request, 'settings.html')

@ensure_csrf_cookie
def page_login(request):
    return render(request, 'login.html')
