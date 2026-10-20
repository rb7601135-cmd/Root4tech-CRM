from django.db import models
from django.conf import settings
from django.utils import timezone
import random
import string

class Client(models.Model):
    class Status(models.TextChoices):
        ACTIVE = 'Active', 'Active'
        INACTIVE = 'Inactive', 'Inactive'
        LEAD_CONVERTED = 'Lead_Converted', 'Lead Converted'
        ARCHIVED = 'Archived', 'Archived'

    client_id = models.CharField(
        max_length=32,
        unique=True,
        editable=False,
        db_index=True,
        help_text="Unique client ID across the entire CRM and future modules."
    )
    name = models.CharField(max_length=200, help_text="Individual contact or primary name")
    company_name = models.CharField(max_length=200, blank=True, default='')
    email = models.EmailField(db_index=True)
    normalized_email = models.CharField(max_length=255, db_index=True)
    phone = models.CharField(max_length=50, blank=True, default='')
    website = models.CharField(max_length=255, blank=True, default='')
    billing_address = models.TextField(blank=True, default='')
    service_interests = models.CharField(
        max_length=500,
        blank=True,
        default='',
        help_text="Comma-separated or primary services of interest"
    )
    client_status = models.CharField(
        max_length=30,
        choices=Status.choices,
        default=Status.ACTIVE,
        db_index=True
    )
    assigned_team_member = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name='assigned_clients'
    )
    notes = models.TextField(blank=True, default='')
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name='created_clients'
    )
    updated_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name='updated_clients'
    )
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['normalized_email']),
            models.Index(fields=['client_status', '-created_at']),
            models.Index(fields=['name']),
            models.Index(fields=['company_name']),
        ]

    def __str__(self):
        comp = f" ({self.company_name})" if self.company_name else ""
        return f"[{self.client_id}] {self.name}{comp}"

    def clean(self):
        super().clean()
        if self.email:
            self.normalized_email = self.email.strip().lower()

    def save(self, *args, **kwargs):
        if self.email:
            self.normalized_email = self.email.strip().lower()

        if not self.client_id:
            # Generate deterministic, clean CLI-XXXXX sequence or unique ID
            last_id = Client.objects.order_by('-id').values_list('id', flat=True).first() or 0
            candidate_id = f"CLI-{last_id + 1001:05d}"
            while Client.objects.filter(client_id=candidate_id).exists():
                last_id += 1
                candidate_id = f"CLI-{last_id + 1001:05d}"
            self.client_id = candidate_id

        super().save(*args, **kwargs)

    @classmethod
    def find_duplicate(cls, email, exclude_id=None):
        """
        Check for existing clients using normalized email for duplicate detection.
        """
        if not email:
            return None
        norm = email.strip().lower()
        qs = cls.objects.filter(normalized_email=norm)
        if exclude_id:
            qs = qs.exclude(id=exclude_id)
        return qs.first()


class ClientNote(models.Model):
    client = models.ForeignKey(Client, on_delete=models.CASCADE, related_name='client_notes')
    author = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        on_delete=models.SET_NULL,
        related_name='authored_client_notes'
    )
    content = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"Note on {self.client.client_id} by {self.author}"


class ClientActivity(models.Model):
    client = models.ForeignKey(Client, on_delete=models.CASCADE, related_name='activities')
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name='client_activities'
    )
    action_type = models.CharField(max_length=100)
    description = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.action_type} on {self.client.client_id}"


class ClientDocument(models.Model):
    client = models.ForeignKey(Client, on_delete=models.CASCADE, related_name='documents')
    uploaded_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL
    )
    title = models.CharField(max_length=200)
    file = models.FileField(upload_to='client_documents/')
    file_size = models.PositiveIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.title} ({self.client.client_id})"
