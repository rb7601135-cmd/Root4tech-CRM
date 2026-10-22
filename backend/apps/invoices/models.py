from django.db import models
from django.conf import settings
from django.utils import timezone
from decimal import Decimal
import datetime

class Invoice(models.Model):
    class Status(models.TextChoices):
        DRAFT = 'Draft', 'Draft'
        ISSUED = 'Issued', 'Issued'
        PARTIALLY_PAID = 'Partially Paid', 'Partially Paid'
        PAID = 'Paid', 'Paid'
        OVERDUE = 'Overdue', 'Overdue'
        CANCELLED = 'Cancelled', 'Cancelled'

    CURRENCY_CHOICES = [
        ('PKR', 'PKR - Pakistani Rupee'),
        ('USD', 'USD - US Dollar'),
        ('GBP', 'GBP - British Pound'),
        ('EUR', 'EUR - Euro'),
        ('AED', 'AED - UAE Dirham'),
        ('SAR', 'SAR - Saudi Riyal'),
        ('CAD', 'CAD - Canadian Dollar'),
    ]

    invoice_number = models.CharField(
        max_length=50,
        unique=True,
        editable=False,
        db_index=True,
        help_text="Unique sequence code like INV-2026-0001"
    )
    title = models.CharField(max_length=255, default='Invoice')

    # Mandatory central client relationship
    client = models.ForeignKey(
        'clients.Client',
        on_delete=models.PROTECT,
        related_name='invoices',
        help_text="Central client record reference"
    )
    quotation = models.ForeignKey(
        'quotations.Quotation',
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name='invoices'
    )
    project = models.ForeignKey(
        'projects.Project',
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name='invoices'
    )

    status = models.CharField(
        max_length=30,
        choices=Status.choices,
        default=Status.DRAFT,
        db_index=True
    )

    issue_date = models.DateField(default=timezone.localdate)
    due_date = models.DateField(null=True, blank=True)

    # Currency & Decimal arithmetic
    currency = models.CharField(max_length=10, choices=CURRENCY_CHOICES, default='PKR')
    exchange_rate_to_base = models.DecimalField(
        max_digits=14,
        decimal_places=4,
        default=Decimal('1.0000'),
        help_text="Exchange rate to base PKR snapshot"
    )
    exchange_rate_source = models.CharField(max_length=100, blank=True, default='')
    exchange_rate_date = models.DateTimeField(null=True, blank=True)

    subtotal = models.DecimalField(max_digits=14, decimal_places=2, default=Decimal('0.00'))
    discount_percentage = models.DecimalField(max_digits=5, decimal_places=2, default=Decimal('0.00'))
    discount_amount = models.DecimalField(max_digits=14, decimal_places=2, default=Decimal('0.00'))
    tax_percentage = models.DecimalField(max_digits=5, decimal_places=2, default=Decimal('0.00'))
    tax_amount = models.DecimalField(max_digits=14, decimal_places=2, default=Decimal('0.00'))
    total_amount = models.DecimalField(max_digits=14, decimal_places=2, default=Decimal('0.00'))
    amount_paid = models.DecimalField(max_digits=14, decimal_places=2, default=Decimal('0.00'))
    remaining_balance = models.DecimalField(max_digits=14, decimal_places=2, default=Decimal('0.00'))

    terms_and_conditions = models.TextField(
        blank=True,
        default="1. Payment is due strictly by the specified due date.\n2. Please mention the invoice number in the bank transfer reference.\n3. Roo4Tech bank account details are provided below."
    )
    internal_notes = models.TextField(blank=True, default='')

    # Historical document immutable snapshot (Requirement 5)
    client_snapshot = models.JSONField(
        default=dict,
        blank=True,
        help_text="Preserved snapshot of client details when invoice was issued"
    )

    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name='created_invoices'
    )
    updated_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name='updated_invoices'
    )
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['status', '-created_at']),
            models.Index(fields=['client', '-created_at']),
            models.Index(fields=['invoice_number']),
            models.Index(fields=['due_date']),
        ]

    def __str__(self):
        return f"{self.invoice_number} - {self.client.name} ({self.total_amount} {self.currency})"

    def capture_client_snapshot(self):
        """
        Capture immutable historical snapshot of the client information upon issue.
        """
        if self.client:
            self.client_snapshot = {
                'client_id': self.client.client_id,
                'name': self.client.name,
                'company_name': self.client.company_name,
                'email': self.client.email,
                'phone': self.client.phone,
                'website': self.client.website,
                'billing_address': self.client.billing_address,
                'service_interests': self.client.service_interests,
                'captured_at': timezone.now().isoformat()
            }

    def calculate_totals(self):
        """
        Recalculate subtotal, discount, tax, total amount and remaining balance.
        """
        sub = Decimal('0.00')
        for item in self.items.all():
            item.line_total = (Decimal(str(item.quantity)) * Decimal(str(item.unit_price))).quantize(Decimal('0.01'))
            item.save(update_fields=['line_total'])
            sub += item.line_total

        self.subtotal = sub

        if self.discount_percentage > 0:
            self.discount_amount = (self.subtotal * (self.discount_percentage / Decimal('100.00'))).quantize(Decimal('0.01'))
        elif self.discount_amount > 0:
            if self.subtotal > 0:
                self.discount_percentage = ((self.discount_amount / self.subtotal) * Decimal('100.00')).quantize(Decimal('0.01'))
        else:
            self.discount_amount = Decimal('0.00')

        taxable = max(Decimal('0.00'), self.subtotal - self.discount_amount)
        if self.tax_percentage > 0:
            self.tax_amount = (taxable * (self.tax_percentage / Decimal('100.00'))).quantize(Decimal('0.01'))
        else:
            self.tax_amount = Decimal('0.00')

        self.total_amount = taxable + self.tax_amount

        # Calculate payments
        paid = self.payments.aggregate(total=models.Sum('amount'))['total'] or Decimal('0.00')
        self.amount_paid = paid
        self.remaining_balance = max(Decimal('0.00'), self.total_amount - self.amount_paid)

        # Auto-update status based on balance and due date
        today = timezone.now().date()
        if self.status != self.Status.CANCELLED:
            if self.amount_paid >= self.total_amount and self.total_amount > 0:
                self.status = self.Status.PAID
            elif self.amount_paid > 0:
                self.status = self.Status.PARTIALLY_PAID
            elif self.status != self.Status.DRAFT:
                if self.due_date and self.due_date < today:
                    self.status = self.Status.OVERDUE
                else:
                    self.status = self.Status.ISSUED

    def save(self, *args, **kwargs):
        if not self.due_date and self.issue_date:
            self.due_date = self.issue_date + datetime.timedelta(days=15)

        if not self.invoice_number:
            year = timezone.now().strftime('%Y')
            last = Invoice.objects.filter(invoice_number__startswith=f"INV-{year}-").order_by('-id').first()
            if last:
                try:
                    last_seq = int(last.invoice_number.split('-')[-1])
                    seq = last_seq + 1
                except (ValueError, IndexError):
                    seq = Invoice.objects.count() + 1
            else:
                seq = Invoice.objects.count() + 1

            candidate = f"INV-{year}-{seq:04d}"
            while Invoice.objects.filter(invoice_number=candidate).exists():
                seq += 1
                candidate = f"INV-{year}-{seq:04d}"
            self.invoice_number = candidate

        if self.status in [self.Status.ISSUED, self.Status.PARTIALLY_PAID, self.Status.PAID] and not self.client_snapshot:
            self.capture_client_snapshot()

        super().save(*args, **kwargs)


class InvoiceItem(models.Model):
    invoice = models.ForeignKey(
        Invoice,
        on_delete=models.CASCADE,
        related_name='items'
    )
    item_order = models.PositiveIntegerField(default=1)
    description = models.CharField(max_length=500)
    quantity = models.DecimalField(max_digits=10, decimal_places=2, default=Decimal('1.00'))
    unit_price = models.DecimalField(max_digits=14, decimal_places=2, default=Decimal('0.00'))
    line_total = models.DecimalField(max_digits=14, decimal_places=2, default=Decimal('0.00'))

    class Meta:
        ordering = ['item_order', 'id']

    def save(self, *args, **kwargs):
        self.line_total = (Decimal(str(self.quantity)) * Decimal(str(self.unit_price))).quantize(Decimal('0.01'))
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.description} ({self.quantity} x {self.unit_price})"


class Payment(models.Model):
    METHOD_CHOICES = [
        ('Bank Transfer', 'Bank Transfer'),
        ('Credit Card', 'Credit Card'),
        ('Wire Transfer', 'Wire Transfer'),
        ('Cash', 'Cash'),
        ('Cheque', 'Cheque'),
        ('Online', 'Online Payment'),
        ('Other', 'Other'),
    ]

    receipt_number = models.CharField(
        max_length=50,
        unique=True,
        editable=False,
        db_index=True,
        help_text="Unique sequence code like REC-2026-0001"
    )
    invoice = models.ForeignKey(
        Invoice,
        on_delete=models.CASCADE,
        related_name='payments'
    )
    # Linked to central client
    client = models.ForeignKey(
        'clients.Client',
        on_delete=models.PROTECT,
        related_name='payments'
    )
    amount = models.DecimalField(max_digits=14, decimal_places=2)
    currency = models.CharField(max_length=10, default='PKR')
    payment_date = models.DateField(default=timezone.localdate)
    payment_method = models.CharField(max_length=50, choices=METHOD_CHOICES, default='Bank Transfer')
    transaction_reference = models.CharField(max_length=100, blank=True, default='')
    notes = models.TextField(blank=True, default='')

    recorded_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name='recorded_payments'
    )
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        ordering = ['-payment_date', '-created_at']

    def __str__(self):
        return f"{self.receipt_number} - {self.amount} {self.currency} for {self.invoice.invoice_number}"

    def save(self, *args, **kwargs):
        if not self.client and self.invoice:
            self.client = self.invoice.client
        if not self.currency and self.invoice:
            self.currency = self.invoice.currency

        if not self.receipt_number:
            year = timezone.now().strftime('%Y')
            last = Payment.objects.filter(receipt_number__startswith=f"REC-{year}-").order_by('-id').first()
            if last:
                try:
                    last_seq = int(last.receipt_number.split('-')[-1])
                    seq = last_seq + 1
                except (ValueError, IndexError):
                    seq = Payment.objects.count() + 1
            else:
                seq = Payment.objects.count() + 1

            candidate = f"REC-{year}-{seq:04d}"
            while Payment.objects.filter(receipt_number=candidate).exists():
                seq += 1
                candidate = f"REC-{year}-{seq:04d}"
            self.receipt_number = candidate

        super().save(*args, **kwargs)

        # Refresh invoice totals & balance
        self.invoice.calculate_totals()
        self.invoice.save()
