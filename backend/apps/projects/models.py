from django.db import models
from django.conf import settings
from django.utils import timezone
from decimal import Decimal
import datetime

class Project(models.Model):
    class Status(models.TextChoices):
        PLANNING = 'Planning', 'Planning'
        IN_PROGRESS = 'In Progress', 'In Progress'
        ON_HOLD = 'On Hold', 'On Hold'
        COMPLETED = 'Completed', 'Completed'
        CANCELLED = 'Cancelled', 'Cancelled'

    project_code = models.CharField(
        max_length=50,
        unique=True,
        editable=False,
        db_index=True,
        help_text="Unique sequence code like PRJ-2026-0001"
    )
    project_name = models.CharField(max_length=255)
    description = models.TextField(blank=True, default='')

    # Mandatory central client relationship
    client = models.ForeignKey(
        'clients.Client',
        on_delete=models.PROTECT,
        related_name='projects',
        help_text="Central client record reference"
    )
    quotation = models.ForeignKey(
        'quotations.Quotation',
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name='projects'
    )

    status = models.CharField(
        max_length=30,
        choices=Status.choices,
        default=Status.PLANNING,
        db_index=True
    )

    project_manager = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name='managed_projects'
    )
    assigned_team_members = models.ManyToManyField(
        settings.AUTH_USER_MODEL,
        blank=True,
        related_name='assigned_projects'
    )

    start_date = models.DateField(default=timezone.localdate)
    due_date = models.DateField(null=True, blank=True)
    completed_at = models.DateField(null=True, blank=True)

    budget = models.DecimalField(max_digits=14, decimal_places=2, default=Decimal('0.00'))
    currency = models.CharField(max_length=10, default='PKR')

    progress_percentage = models.PositiveIntegerField(
        default=0,
        help_text="Overall project completion percentage (0 - 100%)"
    )

    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name='created_projects'
    )
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['status', '-created_at']),
            models.Index(fields=['client', '-created_at']),
            models.Index(fields=['project_code']),
        ]

    def __str__(self):
        return f"[{self.project_code}] {self.project_name} ({self.client.name})"

    def calculate_progress(self):
        """
        Calculates progress based on completed tasks if tasks exist.
        """
        total_tasks = self.tasks.count()
        if total_tasks > 0:
            done = self.tasks.filter(status='Done').count()
            self.progress_percentage = int((done / total_tasks) * 100)
            self.save(update_fields=['progress_percentage'])

    def save(self, *args, **kwargs):
        if not self.project_code:
            year = timezone.now().strftime('%Y')
            last = Project.objects.filter(project_code__startswith=f"PRJ-{year}-").order_by('-id').first()
            if last:
                try:
                    last_seq = int(last.project_code.split('-')[-1])
                    seq = last_seq + 1
                except (ValueError, IndexError):
                    seq = Project.objects.count() + 1
            else:
                seq = Project.objects.count() + 1

            candidate = f"PRJ-{year}-{seq:04d}"
            while Project.objects.filter(project_code=candidate).exists():
                seq += 1
                candidate = f"PRJ-{year}-{seq:04d}"
            self.project_code = candidate

        super().save(*args, **kwargs)


class ProjectMilestone(models.Model):
    project = models.ForeignKey(Project, on_delete=models.CASCADE, related_name='milestones')
    title = models.CharField(max_length=255)
    description = models.TextField(blank=True, default='')
    due_date = models.DateField(null=True, blank=True)
    deliverables = models.TextField(blank=True, default='')
    budget_allocated = models.DecimalField(max_digits=14, decimal_places=2, default=Decimal('0.00'))
    is_completed = models.BooleanField(default=False)
    completed_at = models.DateField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['due_date', 'id']

    def __str__(self):
        return f"{self.project.project_code} - {self.title}"


class Task(models.Model):
    class Priority(models.TextChoices):
        LOW = 'Low', 'Low'
        MEDIUM = 'Medium', 'Medium'
        HIGH = 'High', 'High'
        URGENT = 'Urgent', 'Urgent'

    class Status(models.TextChoices):
        TODO = 'To Do', 'To Do'
        IN_PROGRESS = 'In Progress', 'In Progress'
        REVIEW = 'In Review', 'In Review'
        DONE = 'Done', 'Done'
        BLOCKED = 'Blocked', 'Blocked'

    project = models.ForeignKey(Project, on_delete=models.CASCADE, related_name='tasks')
    milestone = models.ForeignKey(ProjectMilestone, null=True, blank=True, on_delete=models.SET_NULL, related_name='tasks')
    title = models.CharField(max_length=255)
    description = models.TextField(blank=True, default='')

    assigned_to = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name='assigned_tasks'
    )
    priority = models.CharField(max_length=20, choices=Priority.choices, default=Priority.MEDIUM)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.TODO)

    deadline = models.DateField(null=True, blank=True)
    dependencies = models.CharField(max_length=255, blank=True, default='', help_text="Comma-separated prerequisite task IDs")

    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-priority', 'deadline', '-created_at']

    def __str__(self):
        return f"[{self.project.project_code}] {self.title} ({self.status})"

    def save(self, *args, **kwargs):
        super().save(*args, **kwargs)
        self.project.calculate_progress()


class TaskChecklistItem(models.Model):
    task = models.ForeignKey(Task, on_delete=models.CASCADE, related_name='checklists')
    item_order = models.PositiveIntegerField(default=1)
    description = models.CharField(max_length=300)
    is_completed = models.BooleanField(default=False)

    class Meta:
        ordering = ['item_order', 'id']

    def __str__(self):
        return f"{self.description} ({'Done' if self.is_completed else 'Pending'})"


class TaskComment(models.Model):
    task = models.ForeignKey(Task, on_delete=models.CASCADE, related_name='comments')
    author = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    content = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['created_at']

    def __str__(self):
        return f"Comment by {self.author.full_name} on {self.task.title}"


class ProjectActivity(models.Model):
    project = models.ForeignKey(Project, on_delete=models.CASCADE, related_name='activities')
    user = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL)
    action_type = models.CharField(max_length=100)
    description = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.action_type} on {self.project.project_code}"
