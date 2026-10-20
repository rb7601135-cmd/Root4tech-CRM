from django.db import models
from django.conf import settings
from django.core.exceptions import ValidationError
import os

def validate_logo_file(file):
    max_size_mb = 2.0
    if file.size > max_size_mb * 1024 * 1024:
        raise ValidationError(f"Logo image file size cannot exceed {max_size_mb} MB.")

    valid_extensions = ['.jpg', '.jpeg', '.png', '.webp', '.svg']
    ext = os.path.splitext(file.name)[1].lower()
    if ext not in valid_extensions:
        raise ValidationError(f"Unsupported file extension '{ext}'. Allowed extensions: {', '.join(valid_extensions)}.")


class CompanySettings(models.Model):
    THEME_CHOICES = [
        ('dark', 'Dark'),
        ('light', 'Light'),
        ('system', 'System Default'),
    ]

    company_name = models.CharField(max_length=200, default='Roo4Tech')
    logo = models.ImageField(
        upload_to='company/',
        null=True,
        blank=True,
        validators=[validate_logo_file]
    )
    email = models.EmailField(blank=True, default='contact@roo4tech.com')
    phone = models.CharField(max_length=50, blank=True, default='+92 300 1234567')
    website = models.URLField(blank=True, default='https://roo4tech.com')
    address = models.TextField(blank=True, default='Lahore, Pakistan')
    default_currency = models.CharField(max_length=10, default='PKR')
    theme_preference = models.CharField(max_length=20, choices=THEME_CHOICES, default='dark')

    updated_at = models.DateTimeField(auto_now=True)
    updated_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name='company_settings_updates'
    )

    class Meta:
        verbose_name = 'Company Settings'
        verbose_name_plural = 'Company Settings'

    def __str__(self):
        return self.company_name

    @classmethod
    def get_solo(cls):
        obj, _ = cls.objects.get_or_create(id=1)
        return obj


class ExchangeRate(models.Model):
    CURRENCY_CHOICES = [
        ('PKR', 'Pakistani Rupee (PKR)'),
        ('USD', 'US Dollar (USD)'),
        ('GBP', 'British Pound (GBP)'),
        ('EUR', 'Euro (EUR)'),
        ('AED', 'UAE Dirham (AED)'),
        ('SAR', 'Saudi Riyal (SAR)'),
        ('CAD', 'Canadian Dollar (CAD)'),
    ]

    currency_code = models.CharField(max_length=10, unique=True, choices=CURRENCY_CHOICES)
    rate_to_base = models.DecimalField(
        max_digits=14,
        decimal_places=4,
        default=1.0000,
        help_text="Units of base company currency (PKR) per 1 unit of foreign currency"
    )
    source = models.CharField(max_length=100, default='Authorized Manual Rate')
    updated_at = models.DateTimeField(auto_now=True)
    updated_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name='updated_exchange_rates'
    )

    class Meta:
        ordering = ['currency_code']

    def __str__(self):
        return f"1 {self.currency_code} = {self.rate_to_base} PKR ({self.source})"


class AuditLog(models.Model):
    MODULE_CHOICES = [
        ('AUTH', 'Authentication & Security'),
        ('LEADS', 'Lead Management'),
        ('CLIENTS', 'Client Management'),
        ('TEAM', 'Team & Permissions'),
        ('SETTINGS', 'Company Settings'),
        ('QUOTATIONS', 'Quotations & Proposals'),
        ('INVOICES', 'Invoices & Payments'),
        ('PROJECTS', 'Project Management'),
        ('CALENDAR', 'Calendar & Follow-ups'),
        ('AUTOMATION', 'Automated Workflows'),
        ('SERVICES', 'Services Catalog'),
    ]

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name='audit_logs'
    )
    action = models.CharField(max_length=100, db_index=True)
    module = models.CharField(max_length=30, choices=MODULE_CHOICES, db_index=True)
    entity_id = models.CharField(max_length=100, blank=True, default='', db_index=True)
    description = models.TextField()
    ip_address = models.GenericIPAddressField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['module', '-created_at']),
            models.Index(fields=['action', '-created_at']),
        ]

    def __str__(self):
        actor = self.user.email if self.user else 'System'
        return f"[{self.created_at.strftime('%Y-%m-%d %H:%M')}] {actor} - {self.action}: {self.description[:50]}"


def record_audit_log(user, action, module, entity_id='', description='', ip_address=None):
    """
    Utility to record an audit log entry.
    Ensures that secrets and passwords are never logged.
    """
    return AuditLog.objects.create(
        user=user if (user and user.is_authenticated) else None,
        action=action,
        module=module,
        entity_id=str(entity_id) if entity_id else '',
        description=description,
        ip_address=ip_address
    )


class CompanyService(models.Model):
    CATEGORY_CHOICES = [
        ('Development', 'Software & Web Development'),
        ('Design', 'UI/UX & Graphic Design'),
        ('Mobile', 'Mobile App Development'),
        ('Marketing', 'Digital Marketing & SEO'),
        ('Consulting', 'Tech Consulting & Architecture'),
        ('Video', 'Video Editing & Production'),
        ('Maintenance', 'Support & Maintenance'),
        ('Other', 'Other Services'),
    ]

    BILLING_CHOICES = [
        ('Fixed', 'Fixed Price'),
        ('Hourly', 'Hourly Rate'),
        ('Monthly', 'Monthly Retainer'),
        ('Milestone', 'Per Milestone'),
    ]

    name = models.CharField(max_length=200)
    category = models.CharField(max_length=50, choices=CATEGORY_CHOICES, default='Development')
    description = models.TextField(blank=True, default='')
    default_unit_price = models.DecimalField(max_digits=12, decimal_places=2, default=0.00)
    currency = models.CharField(max_length=10, default='PKR')
    billing_type = models.CharField(max_length=50, choices=BILLING_CHOICES, default='Fixed')
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['name']

    def __str__(self):
        return f"{self.name} ({self.currency} {self.default_unit_price})"

