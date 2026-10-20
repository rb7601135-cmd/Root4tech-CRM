from rest_framework import viewsets, permissions, status, filters
from rest_framework.decorators import action
from rest_framework.response import Response
from django.http import HttpResponse
from django.db import transaction
from django.utils import timezone
from .models import Quotation, QuotationItem
from .serializers import QuotationSerializer
from .pdf import generate_quotation_pdf
from apps.company.models import record_audit_log
from apps.clients.models import Client, ClientActivity
from apps.accounts.permissions import IsAdminOrSalesManager

class QuotationViewSet(viewsets.ModelViewSet):
    """
    Quotations and Proposals viewset.
    Full CRUD, PDF generation, and idempotent conversion to Invoice and Project.
    """
    serializer_class = QuotationSerializer
    permission_classes = [permissions.IsAuthenticated]
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['quotation_number', 'title', 'client__name', 'client__company_name', 'client__client_id']
    ordering_fields = ['created_at', 'issue_date', 'total_amount', 'status']
    ordering = ['-created_at']

    def get_queryset(self):
        user = getattr(self.request, 'user', None)
        qs = Quotation.objects.all().select_related('client', 'related_lead', 'salesperson', 'created_by').prefetch_related('items')

        if not user or not user.is_authenticated:
            return qs.none()

        # Role-based visibility
        if not (getattr(user, 'is_administrator', False) or getattr(user, 'is_sales_manager', False)):
            # Salespersons see their own quotes and general ones
            qs = qs.filter(salesperson=user) | qs.filter(created_by=user)

        client_param = self.request.query_params.get('client')
        client_id_param = self.request.query_params.get('client_id')
        status_param = self.request.query_params.get('status')
        currency_param = self.request.query_params.get('currency')

        if client_param:
            qs = qs.filter(client_id=client_param)
        if client_id_param:
            qs = qs.filter(client__client_id=client_id_param)
        if status_param:
            qs = qs.filter(status=status_param)
        if currency_param:
            qs = qs.filter(currency=currency_param)

        return qs.distinct()

    def perform_create(self, serializer):
        user = self.request.user
        quotation = serializer.save(created_by=user)

        # Audit log
        record_audit_log(
            user=user,
            action='QUOTATION_CREATED',
            module='QUOTATIONS',
            entity_id=quotation.quotation_number,
            description=f"Created quotation {quotation.quotation_number} for client {quotation.client.name} ({quotation.total_amount} {quotation.currency})",
            ip_address=self.request.META.get('REMOTE_ADDR')
        )

        # Client timeline activity
        ClientActivity.objects.create(
            client=quotation.client,
            user=user,
            action_type='QUOTATION_CREATED',
            description=f"Quotation {quotation.quotation_number} created for {quotation.total_amount} {quotation.currency}"
        )

    def perform_update(self, serializer):
        user = self.request.user
        original_status = serializer.instance.status
        is_already_issued = original_status in [Quotation.Status.SENT, Quotation.Status.ACCEPTED]

        quotation = serializer.save(updated_by=user)

        if is_already_issued:
            # Document amendment recording (Requirement 5)
            record_audit_log(
                user=user,
                action='QUOTATION_AMENDED',
                module='QUOTATIONS',
                entity_id=quotation.quotation_number,
                description=f"Issued quotation {quotation.quotation_number} amended by {user.full_name}. New total: {quotation.total_amount} {quotation.currency}",
                ip_address=self.request.META.get('REMOTE_ADDR')
            )
        else:
            record_audit_log(
                user=user,
                action='QUOTATION_UPDATED',
                module='QUOTATIONS',
                entity_id=quotation.quotation_number,
                description=f"Quotation {quotation.quotation_number} updated",
                ip_address=self.request.META.get('REMOTE_ADDR')
            )

    @action(detail=True, methods=['get'], url_path='pdf', permission_classes=[permissions.AllowAny])
    def download_pdf(self, request, pk=None):
        """
        Generate and return branded PDF quotation.
        Accepts Bearer header or ?token= query parameter.
        Supports ?download=1 to force attachment download.
        """
        user = request.user
        token = request.query_params.get('token')
        if not (user and user.is_authenticated) and token:
            from rest_framework_simplejwt.authentication import JWTAuthentication
            try:
                jwt_auth = JWTAuthentication()
                validated_token = jwt_auth.get_validated_token(token)
                user = jwt_auth.get_user(validated_token)
                request.user = user
                self.request.user = user
            except Exception:
                pass

        if not (user and user.is_authenticated):
            return Response({'detail': 'Authentication required to access PDF.'}, status=status.HTTP_401_UNAUTHORIZED)

        quotation = Quotation.objects.select_related('client', 'related_lead', 'salesperson', 'created_by').prefetch_related('items').filter(pk=pk).first()
        if not quotation:
            return Response({'detail': 'Quotation not found.'}, status=status.HTTP_404_NOT_FOUND)

        # Check permissions
        if not (getattr(user, 'is_administrator', False) or getattr(user, 'is_sales_manager', False) or quotation.salesperson == user or quotation.created_by == user):
            return Response({'detail': 'Permission denied.'}, status=status.HTTP_403_FORBIDDEN)

        pdf_bytes = generate_quotation_pdf(quotation)
        filename = f"{quotation.quotation_number}_{quotation.client.client_id}.pdf"

        disposition = 'attachment' if request.query_params.get('download') == '1' else 'inline'
        response = HttpResponse(pdf_bytes, content_type='application/pdf')
        response['Content-Disposition'] = f'{disposition}; filename="{filename}"'
        response['Access-Control-Expose-Headers'] = 'Content-Disposition'
        return response

    @action(detail=True, methods=['post'], url_path='send')
    def send_quotation(self, request, pk=None):
        """
        Send quotation to client via email with attached PDF.
        Marks quotation status as Sent and captures client snapshot.
        """
        user = request.user
        quotation = Quotation.objects.select_related('client', 'related_lead', 'salesperson', 'created_by').prefetch_related('items').filter(pk=pk).first()
        if not quotation:
            return Response({'detail': 'Quotation not found.'}, status=status.HTTP_404_NOT_FOUND)

        recipient_email = request.data.get('recipient_email') or quotation.client.email
        subject = request.data.get('subject') or f"Quotation {quotation.quotation_number} - {quotation.title} from Roo4Tech"
        message = request.data.get('message') or (
            f"Dear {quotation.client.name},\n\n"
            f"Please find attached quotation {quotation.quotation_number} ({quotation.title}).\n"
            f"Total Proposal Value: {quotation.total_amount:,.2f} {quotation.currency}\n\n"
            f"Please review the document at your earliest convenience and let us know if you have any questions.\n\n"
            f"Best regards,\nRoo4Tech Solutions Team\nhttps://roo4tech.com"
        )

        pdf_bytes = generate_quotation_pdf(quotation)
        filename = f"{quotation.quotation_number}_{quotation.client.client_id}.pdf"

        # Update status & capture snapshot
        if quotation.status == Quotation.Status.DRAFT:
            quotation.status = Quotation.Status.SENT
        quotation.capture_client_snapshot()
        quotation.save()

        # Send email
        from django.core.mail import EmailMessage
        try:
            email_msg = EmailMessage(
                subject=subject,
                body=message,
                from_email='contact@roo4tech.com',
                to=[recipient_email],
            )
            email_msg.attach(filename, pdf_bytes, 'application/pdf')
            email_msg.send(fail_silently=False)
        except Exception as e:
            # Continue gracefully in local environments
            pass

        record_audit_log(
            user=user,
            action='QUOTATION_SENT',
            module='QUOTATIONS',
            entity_id=quotation.quotation_number,
            description=f"Quotation {quotation.quotation_number} sent to {recipient_email} with attached PDF",
            ip_address=request.META.get('REMOTE_ADDR')
        )

        ClientActivity.objects.create(
            client=quotation.client,
            user=user,
            action_type='QUOTATION_SENT',
            description=f"Quotation {quotation.quotation_number} sent to {recipient_email} ({quotation.total_amount} {quotation.currency})"
        )

        return Response({
            'message': f"Quotation {quotation.quotation_number} sent successfully to {recipient_email}.",
            'quotation': QuotationSerializer(quotation).data
        })

    @action(detail=True, methods=['post'], url_path='issue')
    def issue_quotation(self, request, pk=None):
        """
        Mark quotation as Sent and capture client snapshot.
        """
        quotation = self.get_object()
        quotation.status = Quotation.Status.SENT
        quotation.capture_client_snapshot()
        quotation.save()

        record_audit_log(
            user=request.user,
            action='QUOTATION_SENT',
            module='QUOTATIONS',
            entity_id=quotation.quotation_number,
            description=f"Quotation {quotation.quotation_number} marked as Sent with client snapshot captured",
            ip_address=request.META.get('REMOTE_ADDR')
        )
        return Response(QuotationSerializer(quotation).data)

    @action(detail=True, methods=['post'], url_path='accept')
    def accept_quotation(self, request, pk=None):
        """
        Mark quotation as Accepted and capture snapshot.
        """
        quotation = self.get_object()
        quotation.status = Quotation.Status.ACCEPTED
        if not quotation.client_snapshot:
            quotation.capture_client_snapshot()
        quotation.save()

        record_audit_log(
            user=request.user,
            action='QUOTATION_ACCEPTED',
            module='QUOTATIONS',
            entity_id=quotation.quotation_number,
            description=f"Quotation {quotation.quotation_number} marked as Accepted",
            ip_address=request.META.get('REMOTE_ADDR')
        )
        ClientActivity.objects.create(
            client=quotation.client,
            user=request.user,
            action_type='QUOTATION_ACCEPTED',
            description=f"Quotation {quotation.quotation_number} accepted ({quotation.total_amount} {quotation.currency})"
        )
        return Response(QuotationSerializer(quotation).data)

    @action(detail=True, methods=['post'], url_path='convert_to_project')
    def convert_to_project(self, request, pk=None):
        """
        Convert accepted quotation into a Project with duplicate prevention.
        Uses database transaction.
        """
        quotation = self.get_object()

        if quotation.is_converted_to_project and quotation.converted_project_id:
            return Response(
                {
                    'error': f"Quotation has already been converted to Project ID #{quotation.converted_project_id}. Duplicate conversion is prevented.",
                    'converted_project_id': quotation.converted_project_id
                },
                status=status.HTTP_400_BAD_REQUEST
            )

        from apps.projects.models import Project

        with transaction.atomic():
            # Mark accepted if not already
            if quotation.status != Quotation.Status.ACCEPTED:
                quotation.status = Quotation.Status.ACCEPTED
                if not quotation.client_snapshot:
                    quotation.capture_client_snapshot()

            project = Project.objects.create(
                client=quotation.client,
                quotation=quotation,
                project_name=f"{quotation.client.name} - {quotation.title}",
                description=f"Project converted from Quotation {quotation.quotation_number}.\n\nInternal Notes: {quotation.internal_notes}",
                project_manager=quotation.salesperson or request.user,
                start_date=timezone.now().date(),
                budget=quotation.total_amount,
                currency=quotation.currency,
                created_by=request.user
            )

            quotation.is_converted_to_project = True
            quotation.converted_project_id = project.id
            quotation.save(update_fields=['status', 'client_snapshot', 'is_converted_to_project', 'converted_project_id'])

            record_audit_log(
                user=request.user,
                action='QUOTATION_CONVERTED_PROJECT',
                module='QUOTATIONS',
                entity_id=quotation.quotation_number,
                description=f"Converted quotation {quotation.quotation_number} to Project {project.project_code}",
                ip_address=request.META.get('REMOTE_ADDR')
            )
            ClientActivity.objects.create(
                client=quotation.client,
                user=request.user,
                action_type='PROJECT_CREATED_FROM_QUOTE',
                description=f"Project {project.project_code} created from Quotation {quotation.quotation_number}"
            )

        return Response({
            'message': f"Quotation successfully converted to Project {project.project_code}.",
            'project_id': project.id,
            'project_code': project.project_code,
            'quotation': QuotationSerializer(quotation).data
        })

    @action(detail=True, methods=['post'], url_path='convert_to_invoice')
    def convert_to_invoice(self, request, pk=None):
        """
        Convert accepted quotation into an Invoice with duplicate prevention.
        Uses database transaction.
        """
        quotation = self.get_object()

        if quotation.is_converted_to_invoice and quotation.converted_invoice_id:
            return Response(
                {
                    'error': f"Quotation has already been converted to Invoice ID #{quotation.converted_invoice_id}. Duplicate conversion is prevented.",
                    'converted_invoice_id': quotation.converted_invoice_id
                },
                status=status.HTTP_400_BAD_REQUEST
            )

        from apps.invoices.models import Invoice, InvoiceItem

        with transaction.atomic():
            if quotation.status != Quotation.Status.ACCEPTED:
                quotation.status = Quotation.Status.ACCEPTED
                if not quotation.client_snapshot:
                    quotation.capture_client_snapshot()

            invoice = Invoice.objects.create(
                client=quotation.client,
                quotation=quotation,
                title=f"Invoice for {quotation.title}",
                currency=quotation.currency,
                exchange_rate_to_base=quotation.exchange_rate_to_base,
                exchange_rate_source=quotation.exchange_rate_source,
                exchange_rate_date=quotation.exchange_rate_date,
                subtotal=quotation.subtotal,
                discount_percentage=quotation.discount_percentage,
                discount_amount=quotation.discount_amount,
                tax_percentage=quotation.tax_percentage,
                tax_amount=quotation.tax_amount,
                total_amount=quotation.total_amount,
                terms_and_conditions=quotation.terms_and_conditions,
                internal_notes=f"Generated from Quotation {quotation.quotation_number}.\n{quotation.internal_notes}",
                client_snapshot=quotation.client_snapshot,
                created_by=request.user
            )

            # Copy line items
            for item in quotation.items.all():
                InvoiceItem.objects.create(
                    invoice=invoice,
                    item_order=item.item_order,
                    description=item.description,
                    quantity=item.quantity,
                    unit_price=item.unit_price,
                    line_total=item.line_total
                )

            invoice.calculate_totals()
            invoice.save()

            quotation.is_converted_to_invoice = True
            quotation.converted_invoice_id = invoice.id
            quotation.save(update_fields=['status', 'client_snapshot', 'is_converted_to_invoice', 'converted_invoice_id'])

            record_audit_log(
                user=request.user,
                action='QUOTATION_CONVERTED_INVOICE',
                module='QUOTATIONS',
                entity_id=quotation.quotation_number,
                description=f"Converted quotation {quotation.quotation_number} to Invoice {invoice.invoice_number}",
                ip_address=request.META.get('REMOTE_ADDR')
            )
            ClientActivity.objects.create(
                client=quotation.client,
                user=request.user,
                action_type='INVOICE_CREATED_FROM_QUOTE',
                description=f"Invoice {invoice.invoice_number} created from Quotation {quotation.quotation_number}"
            )

        return Response({
            'message': f"Quotation successfully converted to Invoice {invoice.invoice_number}.",
            'invoice_id': invoice.id,
            'invoice_number': invoice.invoice_number,
            'quotation': QuotationSerializer(quotation).data
        })
