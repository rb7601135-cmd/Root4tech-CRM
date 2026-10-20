from django.db import models
from django.conf import settings
from django.utils import timezone

class CalendarEvent(models.Model):
    class EventType(models.TextChoices):
        CLIENT_MEETING = 'Client Meeting', 'Client Meeting'
        SALES_CALL = 'Sales Call', 'Sales Call'
        DEMONSTRATION = 'Demonstration', 'Demonstration'
        PROJECT_MILESTONE = 'Project Milestone', 'Project Milestone'
        TASK_DEADLINE = 'Task Deadline', 'Task Deadline'
        FOLLOW_UP_REMINDER = 'Follow-up Reminder', 'Follow-up Reminder'

    class Status(models.TextChoices):
        PENDING = 'Pending', 'Pending'
        COMPLETED = 'Completed', 'Completed'
        OVERDUE = 'Overdue', 'Overdue'
        CANCELLED = 'Cancelled', 'Cancelled'

    title = models.CharField(max_length=255)
    description = models.TextField(blank=True, default='')
    event_type = models.CharField(max_length=30, choices=EventType.choices, default=EventType.FOLLOW_UP_REMINDER, db_index=True)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.PENDING, db_index=True)

    start_time = models.DateTimeField(db_index=True)
    end_time = models.DateTimeField(null=True, blank=True)

    # Linked CRM records (Requirement 8)
    client = models.ForeignKey(
        'clients.Client',
        null=True,
        blank=True,
        on_delete=models.CASCADE,
        related_name='calendar_events'
    )
    lead = models.ForeignKey(
        'leads.Lead',
        null=True,
        blank=True,
        on_delete=models.CASCADE,
        related_name='calendar_events'
    )
    project = models.ForeignKey(
        'projects.Project',
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name='calendar_events'
    )

    assigned_to = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name='assigned_events'
    )
    location_or_link = models.CharField(max_length=255, blank=True, default='')
    outcome_notes = models.TextField(blank=True, default='')

    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL, related_name='created_events')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['start_time']
        indexes = [
            models.Index(fields=['start_time', 'event_type']),
            models.Index(fields=['client', 'status']),
            models.Index(fields=['assigned_to', 'status']),
        ]

    def __str__(self):
        return f"[{self.event_type}] {self.title} ({self.start_time.strftime('%Y-%m-%d %H:%M')})"

    def check_overdue(self):
        if self.status == self.Status.PENDING and self.start_time < timezone.now():
            self.status = self.Status.OVERDUE
            self.save(update_fields=['status'])
