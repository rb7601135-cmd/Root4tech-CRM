import uuid
from django.db import models
from django.conf import settings
from django.utils import timezone
from datetime import timedelta

class Conversation(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='ai_conversations',
        db_index=True
    )
    title = models.CharField(max_length=255, default='New Conversation')
    is_archived = models.BooleanField(default=False, db_index=True)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-updated_at']
        indexes = [
            models.Index(fields=['user', '-updated_at']),
            models.Index(fields=['user', 'is_archived']),
        ]

    def __str__(self):
        return f"{self.title} ({self.user.email})"


class ChatMessage(models.Model):
    class Role(models.TextChoices):
        USER = 'user', 'User'
        ASSISTANT = 'assistant', 'Assistant'
        SYSTEM = 'system', 'System'

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    conversation = models.ForeignKey(
        Conversation,
        on_delete=models.CASCADE,
        related_name='messages',
        db_index=True
    )
    role = models.CharField(max_length=20, choices=Role.choices, default=Role.USER)
    content = models.TextField()
    metadata = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        ordering = ['created_at']
        indexes = [
            models.Index(fields=['conversation', 'created_at']),
        ]

    def __str__(self):
        return f"[{self.role}] {self.content[:40]}..."


class ActionProposal(models.Model):
    """
    Two-Phase Consequential Action Verification Token.
    Guarantees that sensitive actions (creating leads, converting to clients,
    drafting quotations/invoices, tasks, meetings) require explicit user
    confirmation and execute atomically with audit logging.
    """
    class Status(models.TextChoices):
        PENDING = 'PENDING', 'Pending Confirmation'
        EXECUTED = 'EXECUTED', 'Executed'
        CANCELLED = 'CANCELLED', 'Cancelled'
        EXPIRED = 'EXPIRED', 'Expired'

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    token = models.CharField(max_length=64, unique=True, db_index=True)
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='action_proposals'
    )
    conversation = models.ForeignKey(
        Conversation,
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name='action_proposals'
    )
    action_type = models.CharField(max_length=60, db_index=True)
    preview_data = models.JSONField(default=dict)
    payload = models.JSONField(default=dict)
    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.PENDING,
        db_index=True
    )
    execution_result = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    expires_at = models.DateTimeField()

    class Meta:
        ordering = ['-created_at']

    def is_valid(self):
        return self.status == self.Status.PENDING and timezone.now() < self.expires_at


class AssistantSetting(models.Model):
    """
    Admin-level AI Assistant configuration and usage controls.
    """
    PROVIDER_CHOICES = [
        ('openai', 'OpenAI (GPT-4o, GPT-4o-mini)'),
        ('gemini', 'Google Gemini (Gemini 1.5 Flash / Pro)'),
        ('anthropic', 'Anthropic Claude (Claude 3.5 Sonnet)'),
        ('mock', 'Mock / Internal Engine (Local / Testing)'),
    ]

    provider = models.CharField(max_length=30, choices=PROVIDER_CHOICES, default='openai')
    model_name = models.CharField(max_length=100, default='gpt-4o-mini')
    temperature = models.FloatField(default=0.2)
    max_tokens = models.PositiveIntegerField(default=4096)
    is_enabled = models.BooleanField(default=True)
    allowed_roles = models.CharField(
        max_length=255,
        default='Administrator,Sales Manager,Salesperson,Developer,Video Editor'
    )
    updated_at = models.DateTimeField(auto_now=True)
    updated_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL
    )

    class Meta:
        verbose_name = 'Assistant Setting'
        verbose_name_plural = 'Assistant Settings'

    @classmethod
    def get_solo(cls):
        obj, _ = cls.objects.get_or_create(id=1)
        return obj
