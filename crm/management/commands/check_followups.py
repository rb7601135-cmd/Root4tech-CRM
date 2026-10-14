"""
Root4Tech CRM - Follow-Up & Overdue Sales Automation Command (Phase 3)
Can be executed manually or scheduled via Windows Task Scheduler / Cron:
    python manage.py check_followups [--dry-run] [--send-emails]
"""

from django.core.management.base import BaseCommand
from django.utils import timezone
from django.core.mail import send_mail
from django.contrib.auth.models import User
from django.db.models import Q
from datetime import timedelta, date

from crm.models import FollowUp, Lead, Notification, ActivityLog, AgencySetting, StaffProfile


class Command(BaseCommand):
    help = 'Inspects upcoming and overdue follow-ups, sends notifications & email reminders, and logs alerts without duplicates.'

    def add_arguments(self, parser):
        parser.add_argument(
            '--dry-run',
            action='store_true',
            help='Simulate actions without writing notifications or sending emails.'
        )
        parser.add_argument(
            '--force',
            action='store_true',
            help='Bypass 24-hour deduplication threshold.'
        )

    def handle(self, *args, **options):
        dry_run = options['dry_run']
        force = options['force']
        now = timezone.now()
        today = now.date()
        settings = AgencySetting.get_settings()
        reminder_days = getattr(settings, 'reminder_days_before', 1)
        email_enabled = getattr(settings, 'email_notifications_enabled', True)

        self.stdout.write(self.style.NOTICE(
            f"[{now.strftime('%Y-%m-%d %H:%M:%S')}] Starting Root4Tech Follow-Up Automation Check..."
        ))

        stats = {
            'upcoming_processed': 0,
            'overdue_processed': 0,
            'overdue_leads_processed': 0,
            'emails_sent': 0,
            'notifications_created': 0,
            'duplicates_skipped': 0,
        }

        # ---------------------------------------------------------------------
        # 1. Upcoming Follow-Ups (Today up to reminder_days ahead)
        # ---------------------------------------------------------------------
        cutoff_date = today + timedelta(days=reminder_days)
        upcoming_qs = FollowUp.objects.filter(
            status='Scheduled',
            scheduled_date__gte=today,
            scheduled_date__lte=cutoff_date
        ).select_related('lead', 'client', 'assigned_to')

        for item in upcoming_qs:
            # Deduplication: Skip if notified within the last 20 hours unless forced
            if not force and item.last_reminder_sent_at:
                if (now - item.last_reminder_sent_at) < timedelta(hours=20):
                    stats['duplicates_skipped'] += 1
                    continue

            client_or_lead_name = item.lead.name if item.lead else (item.client.company if item.client else 'Prospective Client')
            org_name = item.lead.company if item.lead else (item.client.company if item.client else '')
            time_str = item.scheduled_time.strftime('%I:%M %p') if item.scheduled_time else 'Anytime'
            date_str = item.scheduled_date.strftime('%b %d, %Y')

            title = f"⏰ Upcoming Follow-up: {item.followup_type} with {client_or_lead_name}"
            msg = (
                f"You have a scheduled {item.followup_type.lower()} with {client_or_lead_name} "
                f"({org_name}) on {date_str} at {time_str}. Notes: {item.notes or 'No notes provided.'}"
            )

            stats['upcoming_processed'] += 1

            if not dry_run:
                # In-app notification to assigned salesperson
                Notification.objects.create(
                    recipient=item.assigned_to,
                    role_target='sales' if not item.assigned_to else 'all',
                    title=title,
                    message=msg,
                    category='sales'
                )
                stats['notifications_created'] += 1

                # Send email if configured and user has email
                if email_enabled and item.assigned_to and item.assigned_to.email:
                    try:
                        send_mail(
                            subject=f"[CRM Reminder] {title}",
                            message=f"Hi {item.assigned_to.first_name or item.assigned_to.username},\n\n{msg}\n\nBest regards,\nRoot4Tech CRM Automation",
                            from_email=settings.official_email,
                            recipient_list=[item.assigned_to.email],
                            fail_silently=True
                        )
                        stats['emails_sent'] += 1
                    except Exception as e:
                        self.stderr.write(f"Failed to send email to {item.assigned_to.email}: {e}")

                item.last_reminder_sent_at = now
                item.reminder_count += 1
                item.save(update_fields=['last_reminder_sent_at', 'reminder_count'])

        # ---------------------------------------------------------------------
        # 2. Overdue Follow-Ups (Scheduled date < today and status != 'Completed')
        # ---------------------------------------------------------------------
        overdue_qs = FollowUp.objects.filter(
            scheduled_date__lt=today
        ).exclude(status='Completed').select_related('lead', 'client', 'assigned_to')

        for item in overdue_qs:
            # Mark status as Overdue in database
            if item.status != 'Overdue' and not dry_run:
                item.status = 'Overdue'
                item.save(update_fields=['status'])

            # Deduplication: Skip if notified within the last 24 hours unless forced
            if not force and item.last_reminder_sent_at:
                if (now - item.last_reminder_sent_at) < timedelta(hours=24):
                    stats['duplicates_skipped'] += 1
                    continue

            client_or_lead_name = item.lead.name if item.lead else (item.client.company if item.client else 'Client')
            org_name = item.lead.company if item.lead else (item.client.company if item.client else '')
            assigned_name = item.assigned_to.get_full_name() if item.assigned_to else 'Unassigned'

            title = f"⚠️ Overdue Follow-up: {item.followup_type} with {client_or_lead_name}"
            msg = (
                f"Follow-up with {client_or_lead_name} ({org_name}) scheduled for {item.scheduled_date} "
                f"was missed. Assigned staff: {assigned_name}."
            )

            stats['overdue_processed'] += 1

            if not dry_run:
                # 1. Notify assigned salesperson
                if item.assigned_to:
                    Notification.objects.create(
                        recipient=item.assigned_to,
                        role_target='all',
                        title=title,
                        message=msg,
                        category='sales'
                    )
                    stats['notifications_created'] += 1

                # 2. Notify Sales Managers & Admins about overdue items
                Notification.objects.create(
                    recipient=None,
                    role_target='sales_mgr',
                    title=f"🚨 Manager Alert: {title}",
                    message=f"Attention Manager: {msg}",
                    category='sales'
                )
                stats['notifications_created'] += 1

                # Send email alerts
                if email_enabled:
                    recipients = []
                    if item.assigned_to and item.assigned_to.email:
                        recipients.append(item.assigned_to.email)
                    # Add sales manager emails
                    mgr_emails = list(User.objects.filter(staff_profile__role_key='sales_mgr').values_list('email', flat=True))
                    recipients.extend([m for m in mgr_emails if m and m not in recipients])

                    if recipients:
                        try:
                            send_mail(
                                subject=f"[Action Required] {title}",
                                message=f"Dear Sales Team,\n\n{msg}\n\nPlease update the follow-up status in the CRM portal immediately.\n\nRoot4Tech CRM Automation",
                                from_email=settings.official_email,
                                recipient_list=recipients,
                                fail_silently=True
                            )
                            stats['emails_sent'] += len(recipients)
                        except Exception as e:
                            self.stderr.write(f"Failed to send overdue email: {e}")

                item.last_reminder_sent_at = now
                item.reminder_count += 1
                item.save(update_fields=['status', 'last_reminder_sent_at', 'reminder_count'])

                ActivityLog.objects.create(
                    user=None,
                    action='Automated Overdue Follow-up Alert',
                    entity_type='FollowUp',
                    entity_id=str(item.id),
                    details=msg
                )

        # ---------------------------------------------------------------------
        # 3. Overdue Leads (Active leads with next_follow_up < today)
        # ---------------------------------------------------------------------
        overdue_leads = Lead.objects.filter(
            status='Active',
            next_follow_up__lt=today
        ).exclude(stage__in=['Won', 'Lost']).select_related('assigned_salesperson')

        for lead in overdue_leads:
            if not force and lead.last_overdue_notified_at:
                if (now - lead.last_overdue_notified_at) < timedelta(hours=24):
                    stats['duplicates_skipped'] += 1
                    continue

            stats['overdue_leads_processed'] += 1
            assigned_name = lead.assigned_salesperson.get_full_name() if lead.assigned_salesperson else 'Unassigned'
            lead_msg = f"Lead {lead.name} ({lead.company}, Value: ${lead.estimated_deal_value}) follow-up date ({lead.next_follow_up}) is overdue! Assigned: {assigned_name}."

            if not dry_run:
                # Notify manager
                Notification.objects.create(
                    recipient=None,
                    role_target='sales_mgr',
                    title=f"⚠️ Overdue Lead Alert: {lead.name} ({lead.company})",
                    message=lead_msg,
                    category='sales'
                )
                stats['notifications_created'] += 1

                # Notify assigned salesperson if any
                if lead.assigned_salesperson:
                    Notification.objects.create(
                        recipient=lead.assigned_salesperson,
                        role_target='all',
                        title=f"⚠️ Your Lead Follow-Up is Overdue: {lead.company}",
                        message=lead_msg,
                        category='sales'
                    )
                    stats['notifications_created'] += 1

                lead.last_overdue_notified_at = now
                lead.save(update_fields=['last_overdue_notified_at'])

        # Print summary
        self.stdout.write(self.style.SUCCESS(
            f"Follow-up automation complete! Summary:\n"
            f"  - Upcoming follow-ups notified: {stats['upcoming_processed']}\n"
            f"  - Overdue follow-ups escalated: {stats['overdue_processed']}\n"
            f"  - Overdue leads alerted: {stats['overdue_leads_processed']}\n"
            f"  - In-app notifications generated: {stats['notifications_created']}\n"
            f"  - Email reminders dispatched: {stats['emails_sent']}\n"
            f"  - Duplicates prevented: {stats['duplicates_skipped']}"
        ))
