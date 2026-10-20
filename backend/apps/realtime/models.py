from django.db import models
from django.conf import settings

class Notification(models.Model):
    class NotificationType(models.TextChoices):
        LEAD = 'LEAD', 'Lead'
        CLIENT = 'CLIENT', 'Client'
        QUOTATION = 'QUOTATION', 'Quotation'
        INVOICE = 'INVOICE', 'Invoice'
        PAYMENT = 'PAYMENT', 'Payment'
        PROJECT = 'PROJECT', 'Project'
        TASK = 'TASK', 'Task'
        CALENDAR = 'CALENDAR', 'Calendar Event'
        AUTOMATION = 'AUTOMATION', 'Automated Workflow'

    recipient = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='crm_notifications',
        db_index=True
    )
    title = models.CharField(max_length=255)
    message = models.TextField()
    notification_type = models.CharField(max_length=30, choices=NotificationType.choices, default=NotificationType.AUTOMATION)
    link = models.CharField(max_length=255, blank=True, default='')
    is_read = models.BooleanField(default=False, db_index=True)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['recipient', 'is_read', '-created_at']),
        ]

    def __str__(self):
        return f"Notification for {self.recipient.email}: {self.title}"


def send_crm_notification(recipient, title, message, notification_type='AUTOMATION', link=''):
    """
    Creates an in-app notification for an authorized recipient.
    """
    if not recipient:
        return None
    return Notification.objects.create(
        recipient=recipient,
        title=title,
        message=message,
        notification_type=notification_type,
        link=link
    )
