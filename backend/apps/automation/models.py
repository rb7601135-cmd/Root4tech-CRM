from django.db import models
from django.conf import settings
from django.utils import timezone

class AutomationRule(models.Model):
    class RuleType(models.TextChoices):
        LEAD_FOLLOW_UP = 'LEAD_FOLLOW_UP', 'Lead Follow-up Reminder'
        QUOTATION_EXPIRY = 'QUOTATION_EXPIRY', 'Quotation Expiry Reminder'
        INVOICE_DUE = 'INVOICE_DUE', 'Invoice Due Date Reminder'
        INVOICE_OVERDUE = 'INVOICE_OVERDUE', 'Invoice Overdue Alert'
        PROJECT_DEADLINE = 'PROJECT_DEADLINE', 'Project Deadline Reminder'
        TASK_OVERDUE = 'TASK_OVERDUE', 'Task Overdue Alert'

    rule_type = models.CharField(max_length=50, choices=RuleType.choices, unique=True)
    name = models.CharField(max_length=200)
    is_active = models.BooleanField(default=True)
    days_trigger = models.IntegerField(default=3, help_text="Trigger window in days (e.g., 3 days before expiry/due date)")
    send_in_app = models.BooleanField(default=True)
    send_email = models.BooleanField(default=False)

    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['rule_type']

    def __str__(self):
        return f"{self.name} ({'Active' if self.is_active else 'Disabled'})"


class AutomationLog(models.Model):
    rule_type = models.CharField(max_length=50, db_index=True)
    entity_type = models.CharField(max_length=50)
    entity_id = models.CharField(max_length=100, db_index=True)
    dedup_key = models.CharField(
        max_length=255,
        unique=True,
        db_index=True,
        help_text="Unique key ensuring notifications are strictly sent once per event cycle"
    )
    status = models.CharField(max_length=20, default='SUCCESS')
    message = models.TextField()
    executed_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        ordering = ['-executed_at']

    def __str__(self):
        return f"[{self.rule_type}] {self.entity_id} - {self.status}"
