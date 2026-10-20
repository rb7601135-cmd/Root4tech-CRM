from django.db import models
from django.conf import settings
from apps.clients.models import Client

class Lead(models.Model):
    class Status(models.TextChoices):
        NEW = 'New', 'New'
        CONTACTED = 'Contacted', 'Contacted'
        QUALIFIED = 'Qualified', 'Qualified'
        PROPOSAL = 'Proposal', 'Proposal'
        WON = 'Won', 'Won'
        LOST = 'Lost', 'Lost'

    class Priority(models.TextChoices):
        LOW = 'Low', 'Low'
        MEDIUM = 'Medium', 'Medium'
        HIGH = 'High', 'High'
        URGENT = 'Urgent', 'Urgent'

    class Source(models.TextChoices):
        WEBSITE = 'Website', 'Website'
        REFERRAL = 'Referral', 'Referral'
        LINKEDIN = 'LinkedIn', 'LinkedIn'
        COLD_CALL = 'Cold Call', 'Cold Call'
        SOCIAL_MEDIA = 'Social Media', 'Social Media'
        OTHER = 'Other', 'Other'

    lead_name = models.CharField(max_length=200, help_text="Contact or Lead Name")
    company = models.CharField(max_length=200, blank=True, default='')
    email = models.EmailField(db_index=True)
    normalized_email = models.CharField(max_length=255, db_index=True)
    phone = models.CharField(max_length=50, blank=True, default='')
    website = models.CharField(max_length=255, blank=True, default='')
    interested_service = models.CharField(max_length=255, blank=True, default='')
    estimated_budget = models.DecimalField(
        max_digits=14,
        decimal_places=2,
        null=True,
        blank=True,
        help_text="Estimated budget in PKR"
    )
    lead_source = models.CharField(
        max_length=50,
        choices=Source.choices,
        default=Source.WEBSITE,
        db_index=True
    )
    assigned_salesperson = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name='assigned_leads'
    )
    status = models.CharField(
        max_length=30,
        choices=Status.choices,
        default=Status.NEW,
        db_index=True
    )
    priority = models.CharField(
        max_length=30,
        choices=Priority.choices,
        default=Priority.MEDIUM,
        db_index=True
    )
    next_follow_up_date = models.DateField(null=True, blank=True, db_index=True)
    notes = models.TextField(blank=True, default='')

    # Conversion relationship
    converted_client = models.ForeignKey(
        Client,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name='converted_from_leads',
        help_text="Central client record linked upon lead conversion"
    )
    converted_at = models.DateTimeField(null=True, blank=True)
    converted_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name='converted_leads'
    )

    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name='created_leads'
    )
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['normalized_email']),
            models.Index(fields=['status', '-created_at']),
            models.Index(fields=['priority']),
            models.Index(fields=['next_follow_up_date']),
        ]

    def __str__(self):
        comp = f" ({self.company})" if self.company else ""
        return f"{self.lead_name}{comp} - {self.status}"

    def clean(self):
        super().clean()
        if self.email:
            self.normalized_email = self.email.strip().lower()

    def save(self, *args, **kwargs):
        if self.email:
            self.normalized_email = self.email.strip().lower()
        super().save(*args, **kwargs)

    @property
    def is_converted(self):
        return self.converted_client is not None

    @classmethod
    def find_duplicate(cls, email, exclude_id=None):
        if not email:
            return None
        norm = email.strip().lower()
        qs = cls.objects.filter(normalized_email=norm)
        if exclude_id:
            qs = qs.exclude(id=exclude_id)
        return qs.first()


class LeadNote(models.Model):
    lead = models.ForeignKey(Lead, on_delete=models.CASCADE, related_name='lead_notes')
    author = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        on_delete=models.SET_NULL,
        related_name='authored_lead_notes'
    )
    content = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"Note on {self.lead.lead_name} by {self.author}"


class LeadActivity(models.Model):
    lead = models.ForeignKey(Lead, on_delete=models.CASCADE, related_name='activities')
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name='lead_activities'
    )
    action = models.CharField(max_length=100)
    description = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.action} on {self.lead.lead_name}"
