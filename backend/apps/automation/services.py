from datetime import date, timedelta
from django.utils import timezone
from .models import AutomationRule, AutomationLog
from apps.leads.models import Lead
from apps.quotations.models import Quotation
from apps.invoices.models import Invoice
from apps.projects.models import Project, Task
from apps.realtime.models import send_crm_notification
from apps.accounts.models import User

class AutomationEngine:
    """
    Executes automated CRM workflows with strict deduplication and execution logging.
    """

    @classmethod
    def run_all(cls):
        results = {
            'lead_follow_ups': cls.check_lead_follow_ups(),
            'quotation_expiries': cls.check_quotation_expiries(),
            'invoice_due_dates': cls.check_invoice_due_dates(),
            'invoice_overdues': cls.check_invoice_overdues(),
            'project_deadlines': cls.check_project_deadlines(),
            'task_overdues': cls.check_task_overdues(),
        }
        return results

    @classmethod
    def check_lead_follow_ups(cls):
        rule = AutomationRule.objects.filter(rule_type=AutomationRule.RuleType.LEAD_FOLLOW_UP, is_active=True).first()
        if not rule:
            return 0

        today = timezone.now().date()
        leads = Lead.objects.filter(next_follow_up_date__lte=today, status__in=['New', 'Contacted', 'Qualified', 'Proposal']).select_related('assigned_salesperson')

        count = 0
        for lead in leads:
            dedup_key = f"LEAD_FOLLOW_UP:{lead.id}:{lead.next_follow_up_date}"
            if AutomationLog.objects.filter(dedup_key=dedup_key).exists():
                continue

            # Notify assigned salesperson or admin
            recipient = lead.assigned_salesperson or User.objects.filter(role='Administrator').first()
            if recipient and rule.send_in_app:
                send_crm_notification(
                    recipient=recipient,
                    title=f"Follow-up Due: {lead.lead_name}",
                    message=f"Scheduled follow-up for lead '{lead.lead_name}' ({lead.company}) is due today ({lead.next_follow_up_date}).",
                    notification_type='LEAD',
                    link=f"/leads/{lead.id}"
                )

            AutomationLog.objects.create(
                rule_type=rule.rule_type,
                entity_type='Lead',
                entity_id=str(lead.id),
                dedup_key=dedup_key,
                status='SUCCESS',
                message=f"Sent follow-up reminder for lead {lead.lead_name}"
            )
            count += 1
        return count

    @classmethod
    def check_quotation_expiries(cls):
        rule = AutomationRule.objects.filter(rule_type=AutomationRule.RuleType.QUOTATION_EXPIRY, is_active=True).first()
        if not rule:
            return 0

        today = timezone.now().date()
        window = today + timedelta(days=rule.days_trigger)
        quotes = Quotation.objects.filter(status=Quotation.Status.SENT, expiry_date__lte=window).select_related('salesperson', 'client')

        count = 0
        for quote in quotes:
            dedup_key = f"QUOTE_EXPIRY:{quote.quotation_number}:{quote.expiry_date}"
            if AutomationLog.objects.filter(dedup_key=dedup_key).exists():
                continue

            recipient = quote.salesperson or User.objects.filter(role='Administrator').first()
            if recipient and rule.send_in_app:
                send_crm_notification(
                    recipient=recipient,
                    title=f"Quotation Expiring Soon: {quote.quotation_number}",
                    message=f"Quotation {quote.quotation_number} for {quote.client.name} ({quote.total_amount} {quote.currency}) expires on {quote.expiry_date}.",
                    notification_type='QUOTATION',
                    link=f"/quotations/{quote.id}"
                )

            # Auto mark expired if date passed
            if quote.expiry_date < today:
                quote.status = Quotation.Status.EXPIRED
                quote.save(update_fields=['status'])

            AutomationLog.objects.create(
                rule_type=rule.rule_type,
                entity_type='Quotation',
                entity_id=quote.quotation_number,
                dedup_key=dedup_key,
                status='SUCCESS',
                message=f"Sent expiry notice for quotation {quote.quotation_number}"
            )
            count += 1
        return count

    @classmethod
    def check_invoice_due_dates(cls):
        rule = AutomationRule.objects.filter(rule_type=AutomationRule.RuleType.INVOICE_DUE, is_active=True).first()
        if not rule:
            return 0

        today = timezone.now().date()
        target_date = today + timedelta(days=rule.days_trigger)
        invoices = Invoice.objects.filter(status__in=[Invoice.Status.ISSUED, Invoice.Status.PARTIALLY_PAID], due_date=target_date).select_related('client')

        count = 0
        for inv in invoices:
            dedup_key = f"INV_DUE:{inv.invoice_number}:{inv.due_date}"
            if AutomationLog.objects.filter(dedup_key=dedup_key).exists():
                continue

            recipients = User.objects.filter(role__in=['Administrator', 'Sales Manager'])
            for user in recipients:
                if rule.send_in_app:
                    send_crm_notification(
                        recipient=user,
                        title=f"Invoice Due in {rule.days_trigger} Days: {inv.invoice_number}",
                        message=f"Invoice {inv.invoice_number} for {inv.client.name} (Balance: {inv.remaining_balance} {inv.currency}) is due on {inv.due_date}.",
                        notification_type='INVOICE',
                        link=f"/invoices/{inv.id}"
                    )

            AutomationLog.objects.create(
                rule_type=rule.rule_type,
                entity_type='Invoice',
                entity_id=inv.invoice_number,
                dedup_key=dedup_key,
                status='SUCCESS',
                message=f"Triggered due date reminder for {inv.invoice_number}"
            )
            count += 1
        return count

    @classmethod
    def check_invoice_overdues(cls):
        rule = AutomationRule.objects.filter(rule_type=AutomationRule.RuleType.INVOICE_OVERDUE, is_active=True).first()
        if not rule:
            return 0

        today = timezone.now().date()
        # Find all issued/partially paid invoices past due date
        invoices = Invoice.objects.filter(
            status__in=[Invoice.Status.ISSUED, Invoice.Status.PARTIALLY_PAID],
            due_date__lt=today,
            remaining_balance__gt=0
        ).select_related('client')

        count = 0
        for inv in invoices:
            inv.status = Invoice.Status.OVERDUE
            inv.save(update_fields=['status'])

            dedup_key = f"INV_OVERDUE:{inv.invoice_number}:{today}"
            if AutomationLog.objects.filter(dedup_key=dedup_key).exists():
                continue

            recipients = User.objects.filter(role__in=['Administrator', 'Sales Manager'])
            for user in recipients:
                if rule.send_in_app:
                    send_crm_notification(
                        recipient=user,
                        title=f"OVERDUE INVOICE: {inv.invoice_number}",
                        message=f"Invoice {inv.invoice_number} for {inv.client.name} is OVERDUE! Remaining balance: {inv.remaining_balance} {inv.currency}.",
                        notification_type='INVOICE',
                        link=f"/invoices/{inv.id}"
                    )

            AutomationLog.objects.create(
                rule_type=rule.rule_type,
                entity_type='Invoice',
                entity_id=inv.invoice_number,
                dedup_key=dedup_key,
                status='SUCCESS',
                message=f"Marked overdue and alerted for {inv.invoice_number}"
            )
            count += 1
        return count

    @classmethod
    def check_project_deadlines(cls):
        rule = AutomationRule.objects.filter(rule_type=AutomationRule.RuleType.PROJECT_DEADLINE, is_active=True).first()
        if not rule:
            return 0

        today = timezone.now().date()
        target_date = today + timedelta(days=rule.days_trigger)
        projects = Project.objects.filter(
            status__in=[Project.Status.PLANNING, Project.Status.IN_PROGRESS],
            due_date__lte=target_date
        ).select_related('project_manager')

        count = 0
        for prj in projects:
            dedup_key = f"PRJ_DEADLINE:{prj.project_code}:{prj.due_date}"
            if AutomationLog.objects.filter(dedup_key=dedup_key).exists():
                continue

            recipient = prj.project_manager or User.objects.filter(role='Administrator').first()
            if recipient and rule.send_in_app:
                send_crm_notification(
                    recipient=recipient,
                    title=f"Project Deadline Approaching: {prj.project_code}",
                    message=f"Project '{prj.project_name}' deadline is {prj.due_date}. Current progress: {prj.progress_percentage}%.",
                    notification_type='PROJECT',
                    link=f"/projects/{prj.id}"
                )

            AutomationLog.objects.create(
                rule_type=rule.rule_type,
                entity_type='Project',
                entity_id=prj.project_code,
                dedup_key=dedup_key,
                status='SUCCESS',
                message=f"Notified deadline for project {prj.project_code}"
            )
            count += 1
        return count

    @classmethod
    def check_task_overdues(cls):
        rule = AutomationRule.objects.filter(rule_type=AutomationRule.RuleType.TASK_OVERDUE, is_active=True).first()
        if not rule:
            return 0

        today = timezone.now().date()
        tasks = Task.objects.filter(deadline__lt=today).exclude(status='Done').select_related('assigned_to', 'project')

        count = 0
        for task in tasks:
            dedup_key = f"TASK_OVERDUE:{task.id}:{today}"
            if AutomationLog.objects.filter(dedup_key=dedup_key).exists():
                continue

            recipient = task.assigned_to or task.project.project_manager
            if recipient and rule.send_in_app:
                send_crm_notification(
                    recipient=recipient,
                    title=f"Overdue Task: {task.title}",
                    message=f"Task '{task.title}' on project {task.project.project_code} was due on {task.deadline}.",
                    notification_type='TASK',
                    link=f"/projects/{task.project.id}"
                )

            AutomationLog.objects.create(
                rule_type=rule.rule_type,
                entity_type='Task',
                entity_id=str(task.id),
                dedup_key=dedup_key,
                status='SUCCESS',
                message=f"Logged overdue alert for task {task.title}"
            )
            count += 1
        return count
