"""
Root4Tech CRM - Core Database Models (Phase 2 Backend)
"""

from django.db import models, transaction
from django.contrib.auth.models import User
from django.utils import timezone
from datetime import timedelta
from decimal import Decimal


# -----------------------------------------------------------------------------
# Staff Profile
# -----------------------------------------------------------------------------
class StaffProfile(models.Model):
    ROLE_CHOICES = [
        ('sales_mgr', 'Sales Manager'),
        ('sales', 'Salesperson'),
        ('dev', 'Full-Stack Developer'),
        ('editor', 'Video Editor'),
        ('admin', 'System Administrator'),
    ]

    STATUS_CHOICES = [
        ('Active', 'Active'),
        ('Online', 'Online'),
        ('On Leave', 'On Leave'),
        ('Remote', 'Remote'),
    ]

    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='staff_profile')
    role_key = models.CharField(max_length=20, choices=ROLE_CHOICES, default='sales_mgr')
    role_title = models.CharField(max_length=100, default='Sales Manager')
    phone = models.CharField(max_length=30, blank=True, default='+1 (555) 000-0000')
    avatar = models.CharField(max_length=10, blank=True, default='ST')
    color = models.CharField(max_length=20, default='#2563eb')
    skills = models.JSONField(default=list, blank=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='Active')
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['role_key', 'user__first_name']
        verbose_name = 'Staff Profile'
        verbose_name_plural = 'Staff Profiles'

    def __str__(self):
        return f"{self.user.get_full_name() or self.user.username} ({self.role_title})"

    @property
    def full_name(self):
        return self.user.get_full_name() or self.user.username

    @property
    def email(self):
        return self.user.email

    @property
    def active_projects_count(self):
        return self.user.assigned_projects.filter(status__in=['Active', 'In Review']).count()

    @property
    def pending_tasks_count(self):
        return self.user.tasks.filter(status__in=['Pending', 'In Progress']).count()


# -----------------------------------------------------------------------------
# Service Catalog
# -----------------------------------------------------------------------------
class Service(models.Model):
    CATEGORY_CHOICES = [
        ('Development', 'Development'),
        ('Video Production', 'Video Production'),
        ('Creative Design', 'Creative Design'),
        ('Marketing', 'Marketing'),
        ('Consulting', 'Consulting'),
    ]

    service_id = models.CharField(max_length=20, unique=True, blank=True)
    name = models.CharField(max_length=150, unique=True)
    category = models.CharField(max_length=50, choices=CATEGORY_CHOICES, default='Development')
    price = models.DecimalField(max_digits=10, decimal_places=2, default=Decimal('0.00'))
    unit = models.CharField(max_length=50, default='per project')
    description = models.TextField(blank=True)
    is_active = models.BooleanField(default=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['category', 'name']
        verbose_name = 'Agency Service'
        verbose_name_plural = 'Agency Services'

    def __str__(self):
        return f"{self.name} (${self.price} / {self.unit})"

    def save(self, *args, **kwargs):
        if not self.service_id:
            count = Service.objects.count() + 1
            self.service_id = f"SVC-{count}"
        super().save(*args, **kwargs)


# -----------------------------------------------------------------------------
# Agency Setting & CMS Configuration
# -----------------------------------------------------------------------------
class AgencySetting(models.Model):
    agency_name = models.CharField(max_length=150, default='Root4Tech Digital Agency')
    tagline = models.CharField(max_length=200, default='Full-Stack Development & Creative Video Production')
    official_email = models.EmailField(default='contact@root4tech.com')
    phone = models.CharField(max_length=50, default='+1 (555) 019-4820')
    website = models.URLField(default='https://www.root4tech.com')
    address = models.TextField(default='100 Innovation Way, Suite 400, San Francisco, CA 94105')
    currency_code = models.CharField(max_length=10, default='USD')
    currency_symbol = models.CharField(max_length=5, default='$')
    tax_rate = models.DecimalField(max_digits=5, decimal_places=2, default=Decimal('0.00'))
    email_notifications_enabled = models.BooleanField(default=True)
    reminder_days_before = models.PositiveIntegerField(default=1)
    lead_sources = models.JSONField(default=list, blank=True)
    custom_project_types = models.JSONField(default=list, blank=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = 'Agency Setting'
        verbose_name_plural = 'Agency Settings'

    def __str__(self):
        return self.agency_name

    @classmethod
    def get_settings(cls):
        obj, created = cls.objects.get_or_create(id=1)
        if not obj.lead_sources:
            obj.lead_sources = [
                'LinkedIn Campaign', 'Website Inquiry', 'Referral',
                'Outbound Cold Email', 'Event / Conference', 'Other'
            ]
            obj.save()
        return obj



# -----------------------------------------------------------------------------
# Client Account
# -----------------------------------------------------------------------------
class Client(models.Model):
    STATUS_CHOICES = [
        ('Active', 'Active'),
        ('Inactive', 'Inactive'),
    ]

    client_id = models.CharField(max_length=20, unique=True, blank=True)
    company = models.CharField(max_length=150)
    contact_person = models.CharField(max_length=120)
    email = models.EmailField()
    phone = models.CharField(max_length=30, blank=True)
    industry = models.CharField(max_length=100, blank=True, default='Digital Agency Services')
    address = models.TextField(blank=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='Active')
    total_spent = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal('0.00'))
    account_manager = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='managed_clients')
    converted_from_lead = models.ForeignKey('Lead', on_delete=models.SET_NULL, null=True, blank=True, related_name='client_record')

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']
        verbose_name = 'Client Account'
        verbose_name_plural = 'Client Accounts'

    def __str__(self):
        return f"{self.company} ({self.client_id})"

    def save(self, *args, **kwargs):
        if not self.client_id:
            count = Client.objects.count() + 1
            self.client_id = f"CLI-{str(count).zfill(2)}"
        super().save(*args, **kwargs)

    @property
    def projects_count(self):
        return self.projects.count()


# -----------------------------------------------------------------------------
# Lead & Pipeline
# -----------------------------------------------------------------------------
class Lead(models.Model):
    STAGE_CHOICES = [
        ('New', 'New'),
        ('Contacted', 'Contacted'),
        ('Qualified', 'Qualified'),
        ('Proposal Sent', 'Proposal Sent'),
        ('Won', 'Won'),
        ('Lost', 'Lost'),
    ]

    STATUS_CHOICES = [
        ('Active', 'Active'),
        ('Archived', 'Archived'),
        ('Won', 'Won'),
        ('Lost', 'Lost'),
    ]

    SOURCE_CHOICES = [
        ('LinkedIn Campaign', 'LinkedIn Campaign'),
        ('Website Inquiry', 'Website Inquiry'),
        ('Referral', 'Referral'),
        ('Outbound Cold Email', 'Outbound Cold Email'),
        ('Event / Conference', 'Event / Conference'),
        ('Other', 'Other'),
    ]

    lead_id = models.CharField(max_length=20, unique=True, blank=True)
    name = models.CharField(max_length=120)
    company = models.CharField(max_length=150)
    email = models.EmailField()
    phone = models.CharField(max_length=30, blank=True)
    service_required = models.CharField(max_length=100, default='Website Development')
    lead_source = models.CharField(max_length=50, choices=SOURCE_CHOICES, default='Website Inquiry')
    assigned_salesperson = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='assigned_leads')
    estimated_deal_value = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal('0.00'))
    stage = models.CharField(max_length=30, choices=STAGE_CHOICES, default='New')
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='Active')
    next_follow_up = models.DateField(null=True, blank=True)
    notes = models.TextField(blank=True)
    is_converted = models.BooleanField(default=False)
    converted_client = models.ForeignKey(Client, on_delete=models.SET_NULL, null=True, blank=True, related_name='origin_lead')
    last_overdue_notified_at = models.DateTimeField(null=True, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']
        verbose_name = 'Sales Lead'
        verbose_name_plural = 'Sales Leads'

    def __str__(self):
        return f"{self.name} - {self.company} ({self.lead_id})"

    def save(self, *args, **kwargs):
        if not self.lead_id:
            count = Lead.objects.count() + 1
            self.lead_id = f"LD-{100 + count}"
        super().save(*args, **kwargs)

    @transaction.atomic
    def convert_to_client(self, user=None):
        """
        Converts this lead to a Client account safely without duplicate client companies.
        """
        existing_client = Client.objects.filter(company__iexact=self.company.strip()).first()
        
        if existing_client:
            client = existing_client
            client.total_spent = (client.total_spent or Decimal('0.00')) + (self.estimated_deal_value or Decimal('0.00'))
            client.save()
        else:
            client = Client.objects.create(
                company=self.company.strip(),
                contact_person=self.name.strip(),
                email=self.email,
                phone=self.phone or '+1 (555) 000-0000',
                industry=self.service_required or 'Digital Agency Services',
                total_spent=self.estimated_deal_value or Decimal('0.00'),
                status='Active',
                account_manager=user if user and user.is_authenticated else self.assigned_salesperson,
                converted_from_lead=self,
            )

        self.stage = 'Won'
        self.status = 'Won'
        self.is_converted = True
        self.converted_client = client
        conversion_note = f"\n[Converted to Client Account ({client.client_id}) on {timezone.now().strftime('%Y-%m-%d %H:%M')}]"
        self.notes = (self.notes or '') + conversion_note
        self.save()

        # Log Activity
        ActivityLog.objects.create(
            user=user if user and user.is_authenticated else None,
            action='Converted Lead to Client',
            entity_type='Lead',
            entity_id=self.lead_id,
            details=f"Lead {self.name} ({self.company}) successfully converted to Client {client.company} ({client.client_id})."
        )

        # Create Notification
        Notification.objects.create(
            role_target='all',
            title='🎉 Lead Converted to Client!',
            message=f"{self.name} from {self.company} was converted to an active client ({client.client_id}).",
            category='sales'
        )

        return client

    @transaction.atomic
    def create_project_from_deal(self, service=None, assigned_user=None, creator_user=None):
        """
        Phase 3: Automatically creates a project from a won deal after confirmation.
        Assigns the appropriate developer or video editor based on service type.
        """
        client = self.converted_client
        if not client:
            client = self.convert_to_client(user=creator_user)

        # Match Service if not explicitly passed
        matched_service = service
        if not matched_service and self.service_required:
            matched_service = Service.objects.filter(
                models.Q(name__icontains=self.service_required) | models.Q(category__icontains=self.service_required)
            ).first()

        # Determine project type & default staff assignment
        svc_str = (self.service_required or '').lower() + ' ' + (matched_service.category.lower() if matched_service else '')
        if 'video' in svc_str or 'edit' in svc_str or 'motion' in svc_str:
            project_type = 'Video Production'
            default_staff_role = 'editor'
        else:
            project_type = 'Development'
            default_staff_role = 'dev'

        # Select assigned staff member
        assigned_staff_members = []
        if assigned_user:
            assigned_staff_members.append(assigned_user)
        else:
            matched_staff = StaffProfile.objects.filter(role_key=default_staff_role).first()
            if matched_staff:
                assigned_staff_members.append(matched_staff.user)
            elif StaffProfile.objects.filter(role_key='dev').exists():
                assigned_staff_members.append(StaffProfile.objects.filter(role_key='dev').first().user)

        title = f"{client.company} - {self.service_required or 'Agency Solution'}"
        deadline_date = timezone.now().date() + timedelta(days=30)

        project = Project.objects.create(
            title=title,
            client=client,
            service=matched_service,
            project_type=project_type,
            status='Active',
            priority='High',
            progress=5,
            budget=self.estimated_deal_value or Decimal('5000.00'),
            deadline=deadline_date,
            milestones=[
                {'name': 'Scope & Technical Architecture', 'completed': True},
                {'name': 'Design & Core Implementation', 'completed': False},
                {'name': 'Internal QA & Review', 'completed': False},
                {'name': 'Client Acceptance & Final Delivery', 'completed': False},
            ],
            notes=f"Project generated automatically from won deal {self.lead_id} ({self.name}). Notes: {self.notes}"
        )

        for u in assigned_staff_members:
            project.assigned_staff.add(u)
            Notification.objects.create(
                recipient=u,
                role_target='all',
                title=f"🚀 Project Assigned: {project.title}",
                message=f"You have been assigned to new project {project.title} ({project.project_id}). Deadline: {deadline_date}.",
                category='project'
            )

        ActivityLog.objects.create(
            user=creator_user if creator_user and creator_user.is_authenticated else None,
            action='Created Project from Won Deal',
            entity_type='Project',
            entity_id=project.project_id,
            details=f"Project {project.title} ({project.project_id}) created from won deal {self.lead_id}. Assigned: {[u.get_full_name() for u in assigned_staff_members]}."
        )

        return project


# -----------------------------------------------------------------------------
# Project
# -----------------------------------------------------------------------------
class Project(models.Model):
    STATUS_CHOICES = [
        ('Active', 'Active'),
        ('In Review', 'In Review'),
        ('Ready for Review', 'Ready for Review'),
        ('Planning', 'Planning'),
        ('Completed', 'Completed'),
        ('On Hold', 'On Hold'),
    ]

    PRIORITY_CHOICES = [
        ('Urgent', 'Urgent'),
        ('High', 'High'),
        ('Medium', 'Medium'),
        ('Low', 'Low'),
    ]

    PROJECT_TYPE_CHOICES = [
        ('Development', 'Development'),
        ('Video Production', 'Video Production'),
        ('Design & Marketing', 'Design & Marketing'),
        ('Consulting', 'Consulting'),
    ]

    project_id = models.CharField(max_length=20, unique=True, blank=True)
    title = models.CharField(max_length=180)
    client = models.ForeignKey(Client, on_delete=models.CASCADE, related_name='projects')
    service = models.ForeignKey(Service, on_delete=models.SET_NULL, null=True, blank=True, related_name='projects')
    project_type = models.CharField(max_length=50, choices=PROJECT_TYPE_CHOICES, default='Development')
    assigned_staff = models.ManyToManyField(User, related_name='assigned_projects', blank=True)
    status = models.CharField(max_length=30, choices=STATUS_CHOICES, default='Active')
    priority = models.CharField(max_length=20, choices=PRIORITY_CHOICES, default='Medium')
    progress = models.PositiveSmallIntegerField(default=0)  # 0 to 100
    budget = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal('0.00'))
    deadline = models.DateField(null=True, blank=True)
    revisions_count = models.PositiveIntegerField(default=0)
    milestones = models.JSONField(default=list, blank=True)
    tech_stack = models.JSONField(default=list, blank=True)
    notes = models.TextField(blank=True)
    delivery_link = models.URLField(blank=True)
    preview_link = models.URLField(blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-deadline', '-created_at']
        verbose_name = 'Project'
        verbose_name_plural = 'Projects'

    def __str__(self):
        return f"{self.title} ({self.project_id})"

    def save(self, *args, **kwargs):
        if not self.project_id:
            count = Project.objects.count() + 1
            self.project_id = f"PRJ-{str(count).zfill(2)}"
        super().save(*args, **kwargs)


# -----------------------------------------------------------------------------
# Task
# -----------------------------------------------------------------------------
class Task(models.Model):
    STATUS_CHOICES = [
        ('Pending', 'Pending'),
        ('In Progress', 'In Progress'),
        ('Completed', 'Completed'),
        ('Blocked', 'Blocked'),
    ]

    PRIORITY_CHOICES = [
        ('High', 'High'),
        ('Medium', 'Medium'),
        ('Low', 'Low'),
    ]

    title = models.CharField(max_length=200)
    project = models.ForeignKey(Project, on_delete=models.CASCADE, null=True, blank=True, related_name='tasks')
    assigned_to = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='tasks')
    status = models.CharField(max_length=30, choices=STATUS_CHOICES, default='Pending')
    priority = models.CharField(max_length=20, choices=PRIORITY_CHOICES, default='Medium')
    due_date = models.DateField(null=True, blank=True)
    notes = models.TextField(blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['due_date', '-priority']
        verbose_name = 'Staff Task'
        verbose_name_plural = 'Staff Tasks'

    def __str__(self):
        return f"{self.title} ({self.status})"


# -----------------------------------------------------------------------------
# Follow-Up & Calendar Events
# -----------------------------------------------------------------------------
class FollowUp(models.Model):
    TYPE_CHOICES = [
        ('Call', 'Discovery / Review Call'),
        ('Meeting', 'Client Strategy Meeting'),
        ('Email', 'Email Correspondence'),
        ('Demo', 'Live Software / Video Demo'),
    ]

    STATUS_CHOICES = [
        ('Scheduled', 'Scheduled'),
        ('Completed', 'Completed'),
        ('Overdue', 'Overdue'),
    ]

    lead = models.ForeignKey(Lead, on_delete=models.CASCADE, null=True, blank=True, related_name='followups')
    client = models.ForeignKey(Client, on_delete=models.CASCADE, null=True, blank=True, related_name='followups')
    scheduled_date = models.DateField()
    scheduled_time = models.TimeField(null=True, blank=True)
    followup_type = models.CharField(max_length=30, choices=TYPE_CHOICES, default='Call')
    assigned_to = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='followups')
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='Scheduled')
    notes = models.TextField(blank=True)
    last_reminder_sent_at = models.DateTimeField(null=True, blank=True)
    reminder_count = models.PositiveIntegerField(default=0)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['scheduled_date', 'scheduled_time']
        verbose_name = 'Follow-Up Event'
        verbose_name_plural = 'Follow-Up Events'

    def __str__(self):
        entity = self.lead.company if self.lead else (self.client.company if self.client else 'General')
        return f"{self.followup_type} with {entity} on {self.scheduled_date}"


# -----------------------------------------------------------------------------
# Quotation
# -----------------------------------------------------------------------------
class Quotation(models.Model):
    STATUS_CHOICES = [
        ('Draft', 'Draft'),
        ('Sent', 'Sent'),
        ('Accepted', 'Accepted'),
        ('Declined', 'Declined'),
    ]

    quotation_number = models.CharField(max_length=30, unique=True, blank=True)
    client = models.ForeignKey(Client, on_delete=models.SET_NULL, null=True, blank=True, related_name='quotations')
    client_name_override = models.CharField(max_length=150, blank=True)
    project_scope_title = models.CharField(max_length=250)
    created_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='created_quotations')
    issue_date = models.DateField(default=timezone.now)
    valid_until = models.DateField(null=True, blank=True)
    subtotal = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal('0.00'))
    tax_rate = models.DecimalField(max_digits=5, decimal_places=2, default=Decimal('0.00'))
    discount_amount = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal('0.00'))
    amount = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal('0.00'))
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='Draft')
    notes = models.TextField(blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-issue_date', '-created_at']
        verbose_name = 'Quotation'
        verbose_name_plural = 'Quotations'

    def __str__(self):
        return f"{self.quotation_number} - {self.client_display} (${self.amount})"

    @property
    def client_display(self):
        return self.client.company if self.client else (self.client_name_override or 'Prospective Client')

    def save(self, *args, **kwargs):
        if not self.quotation_number:
            count = Quotation.objects.count() + 1
            self.quotation_number = f"QTN-2026-{str(count).zfill(3)}"
        super().save(*args, **kwargs)


# -----------------------------------------------------------------------------
# Invoice
# -----------------------------------------------------------------------------
class Invoice(models.Model):
    STATUS_CHOICES = [
        ('Draft', 'Draft'),
        ('Sent', 'Sent'),
        ('Partially Paid', 'Partially Paid'),
        ('Paid', 'Paid'),
        ('Overdue', 'Overdue'),
        ('Cancelled', 'Cancelled'),
    ]

    invoice_number = models.CharField(max_length=30, unique=True, blank=True)
    quotation = models.ForeignKey(Quotation, on_delete=models.SET_NULL, null=True, blank=True, related_name='invoices')
    client = models.ForeignKey(Client, on_delete=models.SET_NULL, null=True, blank=True, related_name='invoices')
    project = models.ForeignKey(Project, on_delete=models.SET_NULL, null=True, blank=True, related_name='invoices')
    client_name_override = models.CharField(max_length=150, blank=True)
    project_scope_title = models.CharField(max_length=250)
    created_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='created_invoices')
    issue_date = models.DateField(default=timezone.now)
    due_date = models.DateField()
    subtotal = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal('0.00'))
    tax_rate = models.DecimalField(max_digits=5, decimal_places=2, default=Decimal('0.00'))
    discount_amount = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal('0.00'))
    amount = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal('0.00'))
    paid_amount = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal('0.00'))
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='Draft')
    notes = models.TextField(blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-issue_date', '-created_at']
        verbose_name = 'Invoice Statement'
        verbose_name_plural = 'Invoice Statements'

    def __str__(self):
        return f"{self.invoice_number} - {self.client_display} (${self.amount} - {self.status})"

    @property
    def client_display(self):
        return self.client.company if self.client else (self.client_name_override or 'Client Account')

    @property
    def balance_due(self):
        return max(Decimal('0.00'), (self.amount or Decimal('0.00')) - (self.paid_amount or Decimal('0.00')))

    def save(self, *args, **kwargs):
        if not self.invoice_number:
            count = Invoice.objects.count() + 1
            self.invoice_number = f"INV-2026-{str(count).zfill(3)}"
        super().save(*args, **kwargs)



# -----------------------------------------------------------------------------
# Billing Line Item (for Multi-Service Quotations & Invoices)
# -----------------------------------------------------------------------------
class BillingItem(models.Model):
    quotation = models.ForeignKey(Quotation, on_delete=models.CASCADE, null=True, blank=True, related_name='items')
    invoice = models.ForeignKey(Invoice, on_delete=models.CASCADE, null=True, blank=True, related_name='items')
    service = models.ForeignKey(Service, on_delete=models.SET_NULL, null=True, blank=True, related_name='billing_items')
    description = models.CharField(max_length=250)
    quantity = models.DecimalField(max_digits=8, decimal_places=2, default=Decimal('1.00'))
    unit_rate = models.DecimalField(max_digits=10, decimal_places=2, default=Decimal('0.00'))
    total = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal('0.00'))

    created_at = models.DateTimeField(auto_now_add=True)

    def save(self, *args, **kwargs):
        self.total = Decimal(str(self.quantity)) * Decimal(str(self.unit_rate))
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.description} ({self.quantity} x ${self.unit_rate} = ${self.total})"


# -----------------------------------------------------------------------------
# Payment Receipt
# -----------------------------------------------------------------------------
class Payment(models.Model):
    METHOD_CHOICES = [
        ('Wire Transfer', 'Wire Transfer / Swift'),
        ('Credit Card', 'Credit Card / Stripe'),
        ('PayPal', 'PayPal Business'),
        ('Cash / Cheque', 'Cash / Cheque'),
    ]

    invoice = models.ForeignKey(Invoice, on_delete=models.CASCADE, related_name='payments')
    amount = models.DecimalField(max_digits=12, decimal_places=2)
    payment_date = models.DateField(default=timezone.now)
    payment_method = models.CharField(max_length=30, choices=METHOD_CHOICES, default='Wire Transfer')
    reference_number = models.CharField(max_length=100, blank=True)
    notes = models.TextField(blank=True)
    recorded_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-payment_date']
        verbose_name = 'Payment Receipt'
        verbose_name_plural = 'Payment Receipts'

    def __str__(self):
        return f"Payment of ${self.amount} for {self.invoice.invoice_number}"

    def save(self, *args, **kwargs):
        super().save(*args, **kwargs)
        # Update invoice paid amount & status (Partially Paid or Paid)
        inv = self.invoice
        total_paid = sum((p.amount for p in inv.payments.all()), Decimal('0.00'))
        inv.paid_amount = total_paid
        if inv.amount > 0:
            if inv.paid_amount >= inv.amount:
                inv.status = 'Paid'
            elif inv.paid_amount > 0:
                inv.status = 'Partially Paid'
        inv.save()


# -----------------------------------------------------------------------------
# Notification
# -----------------------------------------------------------------------------
class Notification(models.Model):
    CATEGORY_CHOICES = [
        ('sales', 'Sales & Pipeline'),
        ('project', 'Projects & Milestones'),
        ('billing', 'Billing & Statements'),
        ('system', 'System & Security'),
    ]

    TARGET_ROLE_CHOICES = [
        ('all', 'All Agency Staff'),
        ('sales_mgr', 'Sales Manager'),
        ('sales', 'Salesperson'),
        ('dev', 'Developer'),
        ('editor', 'Video Editor'),
    ]

    recipient = models.ForeignKey(User, on_delete=models.CASCADE, null=True, blank=True, related_name='notifications')
    role_target = models.CharField(max_length=20, choices=TARGET_ROLE_CHOICES, default='all')
    title = models.CharField(max_length=150)
    message = models.TextField()
    category = models.CharField(max_length=20, choices=CATEGORY_CHOICES, default='system')
    is_read = models.BooleanField(default=False)

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']
        verbose_name = 'Notification'
        verbose_name_plural = 'Notifications'

    def __str__(self):
        return f"{self.title} ({self.created_at.strftime('%b %d')})"


# -----------------------------------------------------------------------------
# Activity Log
# -----------------------------------------------------------------------------
class ActivityLog(models.Model):
    user = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='activity_logs')
    action = models.CharField(max_length=100)
    entity_type = models.CharField(max_length=50)
    entity_id = models.CharField(max_length=50, blank=True)
    details = models.TextField(blank=True)
    timestamp = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-timestamp']
        verbose_name = 'Activity Log'
        verbose_name_plural = 'Activity Logs'

    def __str__(self):
        actor = self.user.get_full_name() if self.user else 'System'
        return f"[{self.timestamp.strftime('%Y-%m-%d %H:%M')}] {actor} - {self.action}: {self.details[:60]}"
