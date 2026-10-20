from django.db import models
from django.conf import settings
from django.utils import timezone
from decimal import Decimal
import datetime

class Quotation(models.Model):
    class Status(models.TextChoices):
        DRAFT = 'Draft', 'Draft'
        SENT = 'Sent', 'Sent'
        ACCEPTED = 'Accepted', 'Accepted'
        REJECTED = 'Rejected', 'Rejected'
        EXPIRED = 'Expired', 'Expired'
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

    quotation_number = models.CharField(
        max_length=50,
        unique=True,
        editable=False,
        db_index=True,
        help_text="Unique sequence code like QTN-2026-0001"
    )
    title = models.CharField(max_length=255, default='Project Quotation')
    
    # Mandatory central client relationship
    client = models.ForeignKey(
        'clients.Client',
        on_delete=models.PROTECT,
        related_name='quotations',
        help_text="Central client record reference"
    )
    related_lead = models.ForeignKey(
        'leads.Lead',
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name='quotations'
    )
    salesperson = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name='sales_quotations'
    )

    status = models.CharField(
        max_length=30,
        choices=Status.choices,
        default=Status.DRAFT,
        db_index=True
    )

    issue_date = models.DateField(default=timezone.localdate)
    expiry_date = models.DateField(null=True, blank=True)

    # Currency & Decimal arithmetic
    currency = models.CharField(max_length=10, choices=CURRENCY_CHOICES, default='PKR')
    exchange_rate_to_base = models.DecimalField(
        max_digits=14,
        decimal_places=4,
        default=Decimal('1.0000'),
        help_text="Exchange rate to PKR base currency at quotation time"
    )
    exchange_rate_source = models.CharField(max_length=100, blank=True, default='')
    exchange_rate_date = models.DateTimeField(null=True, blank=True)

    subtotal = models.DecimalField(max_digits=14, decimal_places=2, default=Decimal('0.00'))
    discount_percentage = models.DecimalField(max_digits=5, decimal_places=2, default=Decimal('0.00'))
    discount_amount = models.DecimalField(max_digits=14, decimal_places=2, default=Decimal('0.00'))
    tax_percentage = models.DecimalField(max_digits=5, decimal_places=2, default=Decimal('0.00'))
    tax_amount = models.DecimalField(max_digits=14, decimal_places=2, default=Decimal('0.00'))
    total_amount = models.DecimalField(max_digits=14, decimal_places=2, default=Decimal('0.00'))

    terms_and_conditions = models.TextField(
        blank=True,
        default="1. Quotation valid until the specified expiry date.\n2. 50% advance payment required upon project kickoff.\n3. Roo4Tech warrants high quality deliverables as per approved milestones."
    )
    internal_notes = models.TextField(blank=True, default='')

    # Historical document immutable snapshot (Requirement 5)
    client_snapshot = models.JSONField(
        default=dict,
        blank=True,
        help_text="Preserved snapshot of client details when quotation was issued"
    )

    # Conversion tracking to prevent duplicates (Requirement 3)
    is_converted_to_project = models.BooleanField(default=False)
    converted_project_id = models.IntegerField(null=True, blank=True)
    is_converted_to_invoice = models.BooleanField(default=False)
    converted_invoice_id = models.IntegerField(null=True, blank=True)

    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name='created_quotations'
    )
    updated_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name='updated_quotations'
    )
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['status', '-created_at']),
            models.Index(fields=['client', '-created_at']),
            models.Index(fields=['quotation_number']),
        ]

    def __str__(self):
        return f"{self.quotation_number} - {self.client.name} ({self.total_amount} {self.currency})"

    def capture_client_snapshot(self):
        """
        Preserve a historical snapshot of the client's information.
        Once issued, updates to the client model do not mutate this document.
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
        Recalculate subtotal, discount, tax and grand total with strict Decimal precision.
        """
        sub = Decimal('0.00')
        for item in self.items.all():
            item.line_total = Decimal(str(item.quantity)) * Decimal(str(item.unit_price))
            item.save(update_fields=['line_total'])
            sub += item.line_total

        self.subtotal = sub
        
        # Calculate discount
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

    def save(self, *args, **kwargs):
        # Auto-set expiry date to 30 days from issue if not specified
        if not self.expiry_date and self.issue_date:
            self.expiry_date = self.issue_date + datetime.timedelta(days=30)

        # Generate unique quotation number
        if not self.quotation_number:
            year = timezone.now().strftime('%Y')
            last = Quotation.objects.filter(quotation_number__startswith=f"QTN-{year}-").order_by('-id').first()
            if last:
                try:
                    last_seq = int(last.quotation_number.split('-')[-1])
                    seq = last_seq + 1
                except (ValueError, IndexError):
                    seq = Quotation.objects.count() + 1
            else:
                seq = Quotation.objects.count() + 1
            
            candidate = f"QTN-{year}-{seq:04d}"
            while Quotation.objects.filter(quotation_number=candidate).exists():
                seq += 1
                candidate = f"QTN-{year}-{seq:04d}"
            self.quotation_number = candidate

        # Capture snapshot if changing to Sent or Accepted and no snapshot yet
        if self.status in [self.Status.SENT, self.Status.ACCEPTED] and not self.client_snapshot:
            self.capture_client_snapshot()

        super().save(*args, **kwargs)


class QuotationItem(models.Model):
    quotation = models.ForeignKey(
        Quotation,
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
