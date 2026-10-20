from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import permissions
from django.db.models import Count, Sum, Q
from django.utils import timezone
from datetime import date
from decimal import Decimal

from apps.leads.models import Lead
from apps.clients.models import Client
from apps.accounts.models import User
from apps.company.models import AuditLog
from apps.company.serializers import AuditLogSerializer
from apps.quotations.models import Quotation
from apps.invoices.models import Invoice, Payment
from apps.projects.models import Project, Task
from apps.calendar_events.models import CalendarEvent

class DashboardStatsView(APIView):
    """
    Returns real, database-driven metrics, financial totals and pipeline summary for Roo4Tech CRM Phase 2.
    """
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        today = date.today()
        user = request.user

        # Leads counts
        total_leads = Lead.objects.count()
        new_leads = Lead.objects.filter(status=Lead.Status.NEW).count()
        contacted_leads = Lead.objects.filter(status=Lead.Status.CONTACTED).count()
        qualified_leads = Lead.objects.filter(status=Lead.Status.QUALIFIED).count()
        proposal_leads = Lead.objects.filter(status=Lead.Status.PROPOSAL).count()
        won_leads = Lead.objects.filter(status=Lead.Status.WON).count()
        lost_leads = Lead.objects.filter(status=Lead.Status.LOST).count()

        # Clients counts
        total_clients = Client.objects.count()
        active_clients = Client.objects.filter(client_status=Client.Status.ACTIVE).count()
        converted_clients = Client.objects.filter(client_status=Client.Status.LEAD_CONVERTED).count()
        archived_clients = Client.objects.filter(client_status=Client.Status.ARCHIVED).count()

        # Quotations stats
        quotations_by_status = {}
        for st, _ in Quotation.Status.choices:
            quotations_by_status[st] = Quotation.objects.filter(status=st).count()
        total_quotations = Quotation.objects.count()

        # Invoices stats & financials
        invoices_by_status = {}
        for st, _ in Invoice.Status.choices:
            invoices_by_status[st] = Invoice.objects.filter(status=st).count()
        total_invoices = Invoice.objects.count()

        # Currency-aware totals (Amounts invoiced vs payments collected vs outstanding)
        financial_summary_qs = Invoice.objects.exclude(status=Invoice.Status.CANCELLED).values('currency').annotate(
            total_invoiced=Sum('total_amount'),
            total_paid=Sum('amount_paid'),
            total_outstanding=Sum('remaining_balance')
        )
        financial_summary = [
            {
                'currency': row['currency'],
                'total_invoiced': float(row['total_invoiced'] or 0),
                'total_paid': float(row['total_paid'] or 0),
                'total_outstanding': float(row['total_outstanding'] or 0),
            }
            for row in financial_summary_qs
        ]

        # Overall base currency (PKR) converted estimations
        total_invoiced_pkr = sum(
            Decimal(str(inv.total_amount)) * inv.exchange_rate_to_base
            for inv in Invoice.objects.exclude(status=Invoice.Status.CANCELLED)
        )
        total_paid_pkr = sum(
            Decimal(str(p.amount)) * p.invoice.exchange_rate_to_base
            for p in Payment.objects.select_related('invoice')
        )
        total_outstanding_pkr = sum(
            Decimal(str(inv.remaining_balance)) * inv.exchange_rate_to_base
            for inv in Invoice.objects.exclude(status=Invoice.Status.CANCELLED)
        )

        # Projects stats
        projects_by_status = {}
        for st, _ in Project.Status.choices:
            projects_by_status[st] = Project.objects.filter(status=st).count()
        total_projects = Project.objects.count()
        active_projects = Project.objects.filter(status__in=[Project.Status.PLANNING, Project.Status.IN_PROGRESS]).count()

        # Calendar meetings & follow-ups
        upcoming_meetings = CalendarEvent.objects.filter(
            start_time__gte=timezone.now(),
            status=CalendarEvent.Status.PENDING
        ).count()
        overdue_follow_ups_count = CalendarEvent.objects.filter(
            status=CalendarEvent.Status.OVERDUE
        ).count()

        # Upcoming follow-up leads
        upcoming_leads_qs = Lead.objects.filter(
            next_follow_up_date__gte=today
        ).exclude(
            status__in=[Lead.Status.WON, Lead.Status.LOST]
        ).select_related('assigned_salesperson').order_by('next_follow_up_date')[:8]

        upcoming_follow_ups = [
            {
                'id': lead.id,
                'lead_name': lead.lead_name,
                'company': lead.company,
                'email': lead.email,
                'phone': lead.phone,
                'status': lead.status,
                'priority': lead.priority,
                'next_follow_up_date': lead.next_follow_up_date,
                'assigned_to': lead.assigned_salesperson.full_name if lead.assigned_salesperson else 'Unassigned'
            }
            for lead in upcoming_leads_qs
        ]

        # Pipeline summary (Budget by status)
        pipeline_aggregates = Lead.objects.values('status').annotate(
            count=Count('id'),
            total_budget=Sum('estimated_budget')
        )
        pipeline_map = {item['status']: {'count': item['count'], 'budget': float(item['total_budget'] or 0)} for item in pipeline_aggregates}
        pipeline_summary = []
        for status_val, label in Lead.Status.choices:
            val = pipeline_map.get(status_val, {'count': 0, 'budget': 0.0})
            pipeline_summary.append({
                'status': status_val,
                'label': label,
                'count': val['count'],
                'budget': val['budget'],
            })

        # Team Overview & workload
        total_team = User.objects.count()
        active_team = User.objects.filter(is_active=True).count()
        team_by_role = {}
        for role_val, label in User.Role.choices:
            team_by_role[role_val] = User.objects.filter(role=role_val, is_active=True).count()

        team_workload = []
        for member in User.objects.filter(is_active=True)[:10]:
            tasks_count = Task.objects.filter(assigned_to=member).exclude(status='Done').count()
            projects_count = member.assigned_projects.filter(status__in=[Project.Status.PLANNING, Project.Status.IN_PROGRESS]).count()
            team_workload.append({
                'id': member.id,
                'name': member.full_name,
                'role': member.role,
                'pending_tasks': tasks_count,
                'active_projects': projects_count,
            })

        # Recent activities
        recent_logs = AuditLog.objects.select_related('user').order_by('-created_at')[:8]
        recent_activities = AuditLogSerializer(recent_logs, many=True).data

        return Response({
            'leads': {
                'total': total_leads,
                'new': new_leads,
                'contacted': contacted_leads,
                'qualified': qualified_leads,
                'proposal': proposal_leads,
                'won': won_leads,
                'lost': lost_leads,
            },
            'clients': {
                'total': total_clients,
                'active': active_clients,
                'converted': converted_clients,
                'archived': archived_clients,
            },
            'quotations': {
                'total': total_quotations,
                'by_status': quotations_by_status,
            },
            'invoices': {
                'total': total_invoices,
                'by_status': invoices_by_status,
                'financial_summary': financial_summary,
                'total_invoiced_pkr': float(total_invoiced_pkr),
                'total_paid_pkr': float(total_paid_pkr),
                'total_outstanding_pkr': float(total_outstanding_pkr),
            },
            'projects': {
                'total': total_projects,
                'active': active_projects,
                'by_status': projects_by_status,
            },
            'calendar': {
                'upcoming_meetings': upcoming_meetings,
                'overdue_follow_ups': overdue_follow_ups_count,
            },
            'pipeline_summary': pipeline_summary,
            'upcoming_follow_ups': upcoming_follow_ups,
            'team_overview': {
                'total': total_team,
                'active': active_team,
                'by_role': team_by_role,
            },
            'team_workload': team_workload,
            'recent_activities': recent_activities,
            'phase2_ready': {
                'quotations_count': total_quotations,
                'invoices_count': total_invoices,
                'active_projects': active_projects,
                'phase2_status': 'Phase 2 Live & Operational'
            }
        })
