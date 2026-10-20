from rest_framework import viewsets, permissions, status, filters
from rest_framework.decorators import action
from rest_framework.response import Response
from django.http import HttpResponse
from django.db import transaction
from django.utils import timezone
from decimal import Decimal
from .models import Invoice, InvoiceItem, Payment
from .serializers import InvoiceSerializer, PaymentSerializer
from .pdf import generate_invoice_pdf, generate_receipt_pdf
from apps.company.models import record_audit_log
from apps.clients.models import ClientActivity

class InvoiceViewSet(viewsets.ModelViewSet):
    """
    Invoice management viewset.
    Full CRUD, payment recording, balance tracking, and branded PDF generation.
    """
    serializer_class = InvoiceSerializer
    permission_classes = [permissions.IsAuthenticated]
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['invoice_number', 'title', 'client__name', 'client__company_name', 'client__client_id']
    ordering_fields = ['created_at', 'issue_date', 'due_date', 'total_amount', 'status']
    ordering = ['-created_at']

    def get_queryset(self):
        user = getattr(self.request, 'user', None)
        qs = Invoice.objects.all().select_related('client', 'quotation', 'project', 'created_by').prefetch_related('items', 'payments')

        if not user or not user.is_authenticated:
            return qs.none()

        # Role-based visibility
        if not (getattr(user, 'is_administrator', False) or getattr(user, 'is_sales_manager', False)):
            qs = qs.filter(created_by=user) | qs.filter(client__assigned_team_member=user)

        client_param = self.request.query_params.get('client')
        client_id_param = self.request.query_params.get('client_id')
        status_param = self.request.query_params.get('status')
        currency_param = self.request.query_params.get('currency')
        overdue_param = self.request.query_params.get('overdue')

        if client_param:
            qs = qs.filter(client_id=client_param)
        if client_id_param:
            qs = qs.filter(client__client_id=client_id_param)
        if status_param:
            qs = qs.filter(status=status_param)
        if currency_param:
            qs = qs.filter(currency=currency_param)
        if overdue_param == 'true':
            qs = qs.filter(status=Invoice.Status.OVERDUE)

        return qs.distinct()

    def perform_create(self, serializer):
        user = self.request.user
        invoice = serializer.save(created_by=user)

        record_audit_log(
            user=user,
            action='INVOICE_CREATED',
            module='INVOICES',
            entity_id=invoice.invoice_number,
            description=f"Invoice {invoice.invoice_number} created for {invoice.client.name} ({invoice.total_amount} {invoice.currency})",
            ip_address=self.request.META.get('REMOTE_ADDR')
        )
        ClientActivity.objects.create(
            client=invoice.client,
            user=user,
            action_type='INVOICE_CREATED',
            description=f"Invoice {invoice.invoice_number} generated for {invoice.total_amount} {invoice.currency}"
        )

    def perform_update(self, serializer):
        user = self.request.user
        original_status = serializer.instance.status
        is_already_issued = original_status in [Invoice.Status.ISSUED, Invoice.Status.PARTIALLY_PAID, Invoice.Status.PAID]

        invoice = serializer.save(updated_by=user)

        if is_already_issued:
            record_audit_log(
                user=user,
                action='INVOICE_AMENDED',
                module='INVOICES',
                entity_id=invoice.invoice_number,
                description=f"Issued invoice {invoice.invoice_number} amended by {user.full_name}. New total: {invoice.total_amount} {invoice.currency}",
                ip_address=self.request.META.get('REMOTE_ADDR')
            )
        else:
            record_audit_log(
                user=user,
                action='INVOICE_UPDATED',
                module='INVOICES',
                entity_id=invoice.invoice_number,
                description=f"Invoice {invoice.invoice_number} updated",
                ip_address=self.request.META.get('REMOTE_ADDR')
            )

    @action(detail=True, methods=['get'], url_path='pdf', permission_classes=[permissions.AllowAny])
    def download_pdf(self, request, pk=None):
        """
        Download or view branded invoice PDF.
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

        invoice = Invoice.objects.select_related('client', 'quotation', 'project', 'created_by').prefetch_related('items', 'payments').filter(pk=pk).first()
        if not invoice:
            return Response({'detail': 'Invoice not found.'}, status=status.HTTP_404_NOT_FOUND)

        if not (getattr(user, 'is_administrator', False) or getattr(user, 'is_sales_manager', False) or invoice.created_by == user or (invoice.client and invoice.client.assigned_team_member == user)):
            return Response({'detail': 'Permission denied.'}, status=status.HTTP_403_FORBIDDEN)

        pdf_bytes = generate_invoice_pdf(invoice)
        filename = f"{invoice.invoice_number}_{invoice.client.client_id}.pdf"

        disposition = 'attachment' if request.query_params.get('download') == '1' else 'inline'
        response = HttpResponse(pdf_bytes, content_type='application/pdf')
        response['Content-Disposition'] = f'{disposition}; filename="{filename}"'
        response['Access-Control-Expose-Headers'] = 'Content-Disposition'
        return response

    @action(detail=True, methods=['post'], url_path='send')
    def send_invoice(self, request, pk=None):
        """
        Send invoice to client via email with attached PDF.
        Marks invoice status as Issued and captures client snapshot.
        """
        user = request.user
        invoice = Invoice.objects.select_related('client', 'quotation', 'project', 'created_by').prefetch_related('items', 'payments').filter(pk=pk).first()
        if not invoice:
            return Response({'detail': 'Invoice not found.'}, status=status.HTTP_404_NOT_FOUND)

        recipient_email = request.data.get('recipient_email') or invoice.client.email
        subject = request.data.get('subject') or f"Tax Invoice {invoice.invoice_number} from Roo4Tech"
        message = request.data.get('message') or (
            f"Dear {invoice.client.name},\n\n"
            f"Please find attached tax invoice {invoice.invoice_number} ({invoice.title}).\n"
            f"Total Invoice Amount: {invoice.total_amount:,.2f} {invoice.currency}\n"
            f"Balance Due: {invoice.remaining_balance:,.2f} {invoice.currency}\n"
            f"Due Date: {invoice.due_date}\n\n"
            f"Payment instructions are detailed in the attached document.\n\n"
            f"Best regards,\nRoo4Tech Finance Team\nhttps://roo4tech.com"
        )

        pdf_bytes = generate_invoice_pdf(invoice)
        filename = f"{invoice.invoice_number}_{invoice.client.client_id}.pdf"

        # Update status & capture snapshot
        if invoice.status == Invoice.Status.DRAFT:
            invoice.status = Invoice.Status.ISSUED
        invoice.capture_client_snapshot()
        invoice.save()

        # Send email
        from django.core.mail import EmailMessage
        try:
            email_msg = EmailMessage(
                subject=subject,
                body=message,
                from_email='billing@roo4tech.com',
                to=[recipient_email],
            )
            email_msg.attach(filename, pdf_bytes, 'application/pdf')
            email_msg.send(fail_silently=False)
        except Exception:
            pass

        record_audit_log(
            user=user,
            action='INVOICE_SENT',
            module='INVOICES',
            entity_id=invoice.invoice_number,
            description=f"Invoice {invoice.invoice_number} sent to {recipient_email} with attached PDF",
            ip_address=request.META.get('REMOTE_ADDR')
        )

        ClientActivity.objects.create(
            client=invoice.client,
            user=user,
            action_type='INVOICE_SENT',
            description=f"Invoice {invoice.invoice_number} sent to {recipient_email} ({invoice.total_amount} {invoice.currency})"
        )

        return Response({
            'message': f"Invoice {invoice.invoice_number} sent successfully to {recipient_email}.",
            'invoice': InvoiceSerializer(invoice).data
        })

    @action(detail=True, methods=['post'], url_path='issue')
    def issue_invoice(self, request, pk=None):
        """
        Mark invoice as Issued and capture client snapshot.
        """
        invoice = self.get_object()
        invoice.status = Invoice.Status.ISSUED
        invoice.capture_client_snapshot()
        invoice.save()

        record_audit_log(
            user=request.user,
            action='INVOICE_ISSUED',
            module='INVOICES',
            entity_id=invoice.invoice_number,
            description=f"Invoice {invoice.invoice_number} issued to client {invoice.client.name}",
            ip_address=request.META.get('REMOTE_ADDR')
        )
        return Response(InvoiceSerializer(invoice).data)

    @action(detail=True, methods=['post'], url_path='record_payment')
    def record_payment(self, request, pk=None):
        """
        Record a payment against an invoice with validation and duplicate prevention.
        """
        invoice = self.get_object()

        amount_raw = request.data.get('amount')
        if not amount_raw:
            return Response({'error': 'Payment amount is required.'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            amount = Decimal(str(amount_raw))
        except Exception:
            return Response({'error': 'Invalid payment amount specified.'}, status=status.HTTP_400_BAD_REQUEST)

        if amount <= Decimal('0.00'):
            return Response({'error': 'Payment amount must be greater than zero.'}, status=status.HTTP_400_BAD_REQUEST)

        if amount > invoice.remaining_balance:
            return Response(
                {'error': f"Payment amount ({amount} {invoice.currency}) exceeds remaining balance ({invoice.remaining_balance} {invoice.currency})."},
                status=status.HTTP_400_BAD_REQUEST
            )

        payment_method = request.data.get('payment_method', 'Bank Transfer')
        payment_date = request.data.get('payment_date') or timezone.now().date()
        reference = request.data.get('transaction_reference', '')
        notes = request.data.get('notes', '')

        with transaction.atomic():
            payment = Payment.objects.create(
                invoice=invoice,
                client=invoice.client,
                amount=amount,
                currency=invoice.currency,
                payment_date=payment_date,
                payment_method=payment_method,
                transaction_reference=reference,
                notes=notes,
                recorded_by=request.user
            )

            # Invoice totals are recalculated inside Payment.save()
            invoice.refresh_from_db()

            record_audit_log(
                user=request.user,
                action='PAYMENT_RECORDED',
                module='INVOICES',
                entity_id=payment.receipt_number,
                description=f"Payment {payment.receipt_number} of {amount} {invoice.currency} recorded for Invoice {invoice.invoice_number}. Balance: {invoice.remaining_balance} {invoice.currency}",
                ip_address=request.META.get('REMOTE_ADDR')
            )
            ClientActivity.objects.create(
                client=invoice.client,
                user=request.user,
                action_type='PAYMENT_RECEIVED',
                description=f"Payment of {amount} {invoice.currency} received ({payment.receipt_number}) for Invoice {invoice.invoice_number}"
            )

        return Response({
            'message': f"Payment {payment.receipt_number} recorded successfully.",
            'payment': PaymentSerializer(payment).data,
            'invoice': InvoiceSerializer(invoice).data
        })


class PaymentViewSet(viewsets.ReadOnlyModelViewSet):
    """
    List and retrieve payments with receipt PDF generation.
    """
    serializer_class = PaymentSerializer
    permission_classes = [permissions.IsAuthenticated]
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['receipt_number', 'transaction_reference', 'client__name', 'invoice__invoice_number']
    ordering_fields = ['payment_date', 'created_at', 'amount']
    ordering = ['-payment_date', '-created_at']

    def get_queryset(self):
        user = self.request.user
        qs = Payment.objects.all().select_related('client', 'invoice', 'recorded_by')

        if not (user.is_administrator or user.is_sales_manager):
            qs = qs.filter(recorded_by=user) | qs.filter(client__assigned_team_member=user)

        client_param = self.request.query_params.get('client')
        client_id_param = self.request.query_params.get('client_id')
        invoice_param = self.request.query_params.get('invoice')

        if client_param:
            qs = qs.filter(client_id=client_param)
        if client_id_param:
            qs = qs.filter(client__client_id=client_id_param)
        if invoice_param:
            qs = qs.filter(invoice_id=invoice_param)

        return qs

    @action(detail=True, methods=['get'], url_path='receipt_pdf', permission_classes=[permissions.AllowAny])
    def download_receipt(self, request, pk=None):
        """
        Download or view official payment receipt PDF.
        Accepts Bearer header or ?token= query parameter.
        """
        user = request.user
        token = request.query_params.get('token')
        if not (user and user.is_authenticated) and token:
            from rest_framework_simplejwt.authentication import JWTAuthentication
            try:
                jwt_auth = JWTAuthentication()
                validated_token = jwt_auth.get_validated_token(token)
                user = jwt_auth.get_user(validated_token)
            except Exception:
                pass

        if not (user and user.is_authenticated):
            return Response({'detail': 'Authentication required to access receipt PDF.'}, status=status.HTTP_401_UNAUTHORIZED)

        payment = self.get_object()
        pdf_bytes = generate_receipt_pdf(payment)
        filename = f"{payment.receipt_number}_{payment.client.client_id}.pdf"

        response = HttpResponse(pdf_bytes, content_type='application/pdf')
        response['Content-Disposition'] = f'inline; filename="{filename}"'
        return response
