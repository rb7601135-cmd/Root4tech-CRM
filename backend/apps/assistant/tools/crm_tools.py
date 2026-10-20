import secrets
import json
from decimal import Decimal
from datetime import date, timedelta
from django.db import transaction
from django.db.models import Sum, Q, Count
from django.utils import timezone
from django.core.exceptions import ValidationError

from apps.accounts.models import User
from apps.clients.models import Client, ClientNote, ClientActivity
from apps.leads.models import Lead
from apps.quotations.models import Quotation, QuotationItem
from apps.invoices.models import Invoice, InvoiceItem, Payment
from apps.projects.models import Project, Task
from apps.calendar_events.models import CalendarEvent
from apps.company.models import CompanySettings, ExchangeRate, record_audit_log
from apps.assistant.models import ActionProposal

# OpenAI-compatible function definitions
CRM_TOOL_SCHEMAS = [
    {
        "type": "function",
        "function": {
            "name": "crm_search_clients",
            "description": "Search CRM client database by name, company, email, or client_id (e.g., CLI-01001).",
            "parameters": {
                "type": "object",
                "properties": {
                    "query": {"type": "string", "description": "Client name, company, email, or client ID."},
                    "limit": {"type": "integer", "description": "Maximum number of clients to return (default 5)."}
                },
                "required": ["query"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "crm_get_client_details",
            "description": "Retrieve comprehensive 360-degree profile for a specific client by client_id or internal ID.",
            "parameters": {
                "type": "object",
                "properties": {
                    "client_id": {"type": "string", "description": "The unique client identifier like CLI-01001 or numeric id."}
                },
                "required": ["client_id"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "crm_search_leads",
            "description": "Search sales leads with optional status or priority filtering.",
            "parameters": {
                "type": "object",
                "properties": {
                    "query": {"type": "string", "description": "Lead contact name, company name, or email."},
                    "status": {"type": "string", "enum": ["New", "Contacted", "Qualified", "Proposal", "Won", "Lost"], "description": "Filter by lead pipeline stage."},
                    "priority": {"type": "string", "enum": ["Low", "Medium", "High", "Urgent"], "description": "Filter by priority level."},
                    "limit": {"type": "integer", "description": "Maximum results to return."}
                }
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "crm_get_lead_details",
            "description": "Fetch details of a specific lead by lead ID.",
            "parameters": {
                "type": "object",
                "properties": {
                    "lead_id": {"type": "integer", "description": "The numeric ID of the lead."}
                },
                "required": ["lead_id"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "crm_get_overdue_invoices",
            "description": "Fetch all overdue invoices and outstanding payment balances.",
            "parameters": {
                "type": "object",
                "properties": {}
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "crm_get_sales_metrics",
            "description": "Fetch verified sales performance, total revenue in PKR, won leads, and comparison with previous month.",
            "parameters": {
                "type": "object",
                "properties": {
                    "period": {"type": "string", "enum": ["this_month", "last_month", "all_time"], "description": "Reporting period."}
                }
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "crm_get_delayed_projects",
            "description": "List all active client projects that are behind schedule or past their due date.",
            "parameters": {
                "type": "object",
                "properties": {}
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "crm_get_team_workload",
            "description": "Get summary of tasks and project assignments per team member (Developers, Video Editors, Sales).",
            "parameters": {
                "type": "object",
                "properties": {}
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "crm_get_calendar_events",
            "description": "Fetch scheduled meetings, sales calls, and follow-up reminders.",
            "parameters": {
                "type": "object",
                "properties": {
                    "days_ahead": {"type": "integer", "description": "Number of days ahead to search (default 7)."}
                }
            }
        }
    },
    # Two-Phase Consequential Action Proposals
    {
        "type": "function",
        "function": {
            "name": "crm_propose_create_lead",
            "description": "Propose creating a new lead. Returns a preview card requiring explicit user confirmation.",
            "parameters": {
                "type": "object",
                "properties": {
                    "lead_name": {"type": "string", "description": "Lead contact full name."},
                    "email": {"type": "string", "description": "Email address of lead."},
                    "phone": {"type": "string", "description": "Phone number."},
                    "company": {"type": "string", "description": "Company name."},
                    "interested_service": {"type": "string", "description": "Requested service."},
                    "estimated_budget": {"type": "number", "description": "Estimated budget in PKR."},
                    "lead_source": {"type": "string", "enum": ["Website", "Referral", "LinkedIn", "Cold Call", "Social Media", "Other"]}
                },
                "required": ["lead_name", "email"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "crm_propose_convert_lead",
            "description": "Propose converting an existing lead into a centralized Client with persistent Client ID.",
            "parameters": {
                "type": "object",
                "properties": {
                    "lead_id": {"type": "integer", "description": "Numeric ID of the lead to convert."}
                },
                "required": ["lead_id"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "crm_propose_create_task",
            "description": "Propose creating a project task for a developer, designer, or team member.",
            "parameters": {
                "type": "object",
                "properties": {
                    "project_code": {"type": "string", "description": "Project code like PRJ-2026-0001."},
                    "title": {"type": "string", "description": "Task title."},
                    "description": {"type": "string", "description": "Detailed task instructions."},
                    "assigned_to_email": {"type": "string", "description": "Email of assignee."},
                    "priority": {"type": "string", "enum": ["Low", "Medium", "High", "Urgent"]},
                    "deadline": {"type": "string", "description": "Deadline YYYY-MM-DD"}
                },
                "required": ["project_code", "title"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "crm_propose_schedule_event",
            "description": "Propose scheduling a client meeting, demonstration, or follow-up call.",
            "parameters": {
                "type": "object",
                "properties": {
                    "title": {"type": "string", "description": "Meeting or event title."},
                    "event_type": {"type": "string", "enum": ["Client Meeting", "Sales Call", "Demonstration", "Follow-up Reminder", "Project Milestone"]},
                    "start_time": {"type": "string", "description": "Start datetime in ISO format (YYYY-MM-DDTHH:MM)."},
                    "client_id": {"type": "string", "description": "Optional client ID (e.g. CLI-01001)."},
                    "lead_id": {"type": "integer", "description": "Optional lead ID."}
                },
                "required": ["title", "start_time"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "crm_propose_draft_quotation",
            "description": "Propose creating a draft quotation for an existing client.",
            "parameters": {
                "type": "object",
                "properties": {
                    "client_id": {"type": "string", "description": "Client ID (e.g. CLI-01001)."},
                    "title": {"type": "string", "description": "Title of quotation."},
                    "currency": {"type": "string", "description": "Currency code (default PKR)."},
                    "items": {
                        "type": "array",
                        "items": {
                            "type": "object",
                            "properties": {
                                "description": {"type": "string"},
                                "quantity": {"type": "number"},
                                "unit_price": {"type": "number"}
                            },
                            "required": ["description", "unit_price"]
                        }
                    }
                },
                "required": ["client_id", "title", "items"]
            }
        }
    }
]


# Tool Implementation functions
def execute_crm_tool(user, tool_name, args, conversation=None):
    """
    Executes an allowlisted CRM tool with strict authorization checks.
    Returns verified facts, calculation results, or action proposal previews.
    """
    try:
        if tool_name == "crm_search_clients":
            return tool_search_clients(user, args.get('query', ''), args.get('limit', 5))
        elif tool_name == "crm_get_client_details":
            return tool_get_client_details(user, args.get('client_id'))
        elif tool_name == "crm_search_leads":
            return tool_search_leads(user, args.get('query'), args.get('status'), args.get('priority'), args.get('limit', 5))
        elif tool_name == "crm_get_lead_details":
            return tool_get_lead_details(user, args.get('lead_id'))
        elif tool_name == "crm_get_overdue_invoices":
            return tool_get_overdue_invoices(user)
        elif tool_name == "crm_get_sales_metrics":
            return tool_get_sales_metrics(user, args.get('period', 'this_month'))
        elif tool_name == "crm_get_delayed_projects":
            return tool_get_delayed_projects(user)
        elif tool_name == "crm_get_team_workload":
            return tool_get_team_workload(user)
        elif tool_name == "crm_get_calendar_events":
            return tool_get_calendar_events(user, args.get('days_ahead', 7))
        # Consequential proposals
        elif tool_name == "crm_propose_create_lead":
            return tool_propose_create_lead(user, args, conversation)
        elif tool_name == "crm_propose_convert_lead":
            return tool_propose_convert_lead(user, args.get('lead_id'), conversation)
        elif tool_name == "crm_propose_create_task":
            return tool_propose_create_task(user, args, conversation)
        elif tool_name == "crm_propose_schedule_event":
            return tool_propose_schedule_event(user, args, conversation)
        elif tool_name == "crm_propose_draft_quotation":
            return tool_propose_draft_quotation(user, args, conversation)
        else:
            return {"error": f"Tool '{tool_name}' is not in the authorized CRM tool allowlist."}
    except Exception as e:
        return {"error": f"Error executing tool '{tool_name}': {str(e)}"}


# --- READ TOOLS ---
def tool_search_clients(user, query, limit=5):
    q = query.strip()
    qs = Client.objects.filter(
        Q(name__icontains=q) |
        Q(company_name__icontains=q) |
        Q(email__icontains=q) |
        Q(client_id__icontains=q)
    )[:limit]

    results = []
    for c in qs:
        results.append({
            "client_id": c.client_id,
            "name": c.name,
            "company_name": c.company_name,
            "email": c.email,
            "phone": c.phone,
            "status": c.client_status,
            "service_interests": c.service_interests,
            "view_url": f"/clients"
        })
    return {"verified_fact": True, "count": len(results), "clients": results}


def tool_get_client_details(user, client_id):
    if not client_id:
        return {"error": "Client identifier is required."}

    client = Client.objects.filter(
        Q(client_id__iexact=str(client_id).strip()) | Q(id__iexact=str(client_id).strip())
    ).first()

    if not client:
        return {"verified_fact": True, "found": False, "message": f"No client found matching ID '{client_id}'."}

    # Gather related records
    quotes = client.quotations.all()[:5]
    invoices = client.invoices.all()[:5]
    projects = client.projects.all()[:5]

    total_invoiced = client.invoices.aggregate(total=Sum('total_amount'))['total'] or Decimal('0.00')
    total_paid = client.invoices.aggregate(total=Sum('amount_paid'))['total'] or Decimal('0.00')
    balance_due = total_invoiced - total_paid

    return {
        "verified_fact": True,
        "found": True,
        "client": {
            "client_id": client.client_id,
            "name": client.name,
            "company_name": client.company_name,
            "email": client.email,
            "phone": client.phone,
            "status": client.client_status,
            "service_interests": client.service_interests,
            "financial_summary_pkr": {
                "total_invoiced": f"{Decimal(str(total_invoiced)):.2f}",
                "total_paid": f"{Decimal(str(total_paid)):.2f}",
                "outstanding_balance": f"{Decimal(str(balance_due)):.2f}"
            },
            "recent_quotations": [
                {"number": q.quotation_number, "status": q.status, "total": str(q.total_amount), "currency": q.currency}
                for q in quotes
            ],
            "recent_invoices": [
                {"number": inv.invoice_number, "status": inv.status, "total": str(inv.total_amount), "currency": inv.currency}
                for inv in invoices
            ],
            "active_projects": [
                {"code": p.project_code, "name": p.project_name, "status": p.status, "progress": f"{p.progress_percentage}%"}
                for p in projects
            ],
            "view_url": f"/clients"
        }
    }


def tool_search_leads(user, query=None, status=None, priority=None, limit=5):
    qs = Lead.objects.all()
    if query:
        q = query.strip()
        qs = qs.filter(Q(lead_name__icontains=q) | Q(company__icontains=q) | Q(email__icontains=q))
    if status:
        qs = qs.filter(status=status)
    if priority:
        qs = qs.filter(priority=priority)

    leads = qs[:limit]
    results = []
    for l in leads:
        results.append({
            "lead_id": l.id,
            "lead_name": l.lead_name,
            "company": l.company,
            "email": l.email,
            "status": l.status,
            "priority": l.priority,
            "interested_service": l.interested_service,
            "estimated_budget_pkr": str(l.estimated_budget) if l.estimated_budget else None,
            "next_follow_up": str(l.next_follow_up_date) if l.next_follow_up_date else None,
            "is_converted": bool(l.converted_client),
            "converted_client_id": l.converted_client.client_id if l.converted_client else None
        })
    return {"verified_fact": True, "count": len(results), "leads": results}


def tool_get_lead_details(user, lead_id):
    lead = Lead.objects.filter(id=lead_id).first()
    if not lead:
        return {"verified_fact": True, "found": False, "message": f"Lead #{lead_id} not found."}

    return {
        "verified_fact": True,
        "found": True,
        "lead": {
            "lead_id": lead.id,
            "lead_name": lead.lead_name,
            "company": lead.company,
            "email": lead.email,
            "phone": lead.phone,
            "status": lead.status,
            "priority": lead.priority,
            "source": lead.lead_source,
            "interested_service": lead.interested_service,
            "estimated_budget_pkr": str(lead.estimated_budget) if lead.estimated_budget else None,
            "next_follow_up": str(lead.next_follow_up_date) if lead.next_follow_up_date else None,
            "assigned_salesperson": lead.assigned_salesperson.full_name if lead.assigned_salesperson else None,
            "notes": lead.notes,
            "is_converted": bool(lead.converted_client),
            "converted_client_id": lead.converted_client.client_id if lead.converted_client else None,
            "view_url": f"/leads/{lead.id}"
        }
    }


def tool_get_overdue_invoices(user):
    overdue_qs = Invoice.objects.filter(status__in=[Invoice.Status.OVERDUE, Invoice.Status.ISSUED]).exclude(status=Invoice.Status.PAID)
    
    # Filter those past due date
    today = timezone.localdate()
    overdue_qs = overdue_qs.filter(due_date__lt=today)

    results = []
    total_overdue = Decimal('0.00')

    for inv in overdue_qs[:15]:
        balance = inv.total_amount - inv.amount_paid
        total_overdue += balance
        results.append({
            "invoice_number": inv.invoice_number,
            "client_name": inv.client.name,
            "client_id": inv.client.client_id,
            "issue_date": str(inv.issue_date),
            "due_date": str(inv.due_date),
            "days_overdue": (today - inv.due_date).days,
            "total_amount": str(inv.total_amount),
            "amount_paid": str(inv.amount_paid),
            "balance_due": str(balance),
            "currency": inv.currency
        })

    return {
        "verified_fact": True,
        "count": len(results),
        "total_overdue_amount_pkr": str(total_overdue),
        "overdue_invoices": results
    }


def tool_get_sales_metrics(user, period='this_month'):
    today = timezone.localdate()
    if period == 'last_month':
        first_current = today.replace(day=1)
        last_prev = first_current - timedelta(days=1)
        start_date = last_prev.replace(day=1)
        end_date = last_prev
        period_label = f"{start_date.strftime('%B %Y')}"
    elif period == 'all_time':
        start_date = date(2020, 1, 1)
        end_date = today
        period_label = "All Time"
    else: # this_month
        start_date = today.replace(day=1)
        end_date = today
        period_label = f"{start_date.strftime('%B %Y')} (to date)"

    # Actual invoice payments received
    payments = Payment.objects.filter(payment_date__gte=start_date, payment_date__lte=end_date)
    revenue_collected = payments.aggregate(total=Sum('amount'))['total'] or Decimal('0.00')

    # Leads won in this period
    leads_won = Lead.objects.filter(status='Won', updated_at__date__gte=start_date, updated_at__date__lte=end_date).count()
    leads_new = Lead.objects.filter(created_at__date__gte=start_date, created_at__date__lte=end_date).count()

    # Quotations accepted
    quotes_accepted = Quotation.objects.filter(status='Accepted', updated_at__date__gte=start_date, updated_at__date__lte=end_date)
    quotes_value = quotes_accepted.aggregate(total=Sum('total_amount'))['total'] or Decimal('0.00')

    return {
        "verified_fact": True,
        "period": period_label,
        "revenue_collected_pkr": str(revenue_collected),
        "new_leads_acquired": leads_new,
        "deals_won_count": leads_won,
        "accepted_proposals_value_pkr": str(quotes_value),
        "currency": "PKR"
    }


def tool_get_delayed_projects(user):
    today = timezone.localdate()
    qs = Project.objects.filter(
        status__in=[Project.Status.IN_PROGRESS, Project.Status.PLANNING],
        due_date__lt=today
    )
    delayed = []
    for p in qs[:10]:
        delayed.append({
            "project_code": p.project_code,
            "project_name": p.project_name,
            "client": p.client.name,
            "client_id": p.client.client_id,
            "due_date": str(p.due_date),
            "days_overdue": (today - p.due_date).days,
            "progress_percentage": f"{p.progress_percentage}%",
            "manager": p.project_manager.full_name if p.project_manager else "Unassigned"
        })
    return {"verified_fact": True, "count": len(delayed), "delayed_projects": delayed}


def tool_get_team_workload(user):
    members = User.objects.filter(is_active=True).exclude(role=User.Role.ADMINISTRATOR)
    workload = []
    for m in members:
        active_tasks = Task.objects.filter(assigned_to=m, status__in=['To Do', 'In Progress', 'In Review']).count()
        completed_tasks = Task.objects.filter(assigned_to=m, status='Done').count()
        workload.append({
            "name": m.full_name,
            "email": m.email,
            "role": m.role,
            "active_tasks_count": active_tasks,
            "completed_tasks_count": completed_tasks
        })
    return {"verified_fact": True, "team_workload": workload}


def tool_get_calendar_events(user, days_ahead=7):
    today = timezone.now()
    end = today + timedelta(days=days_ahead)
    events = CalendarEvent.objects.filter(start_time__gte=today, start_time__lte=end).order_by('start_time')[:10]
    results = []
    for ev in events:
        results.append({
            "id": ev.id,
            "title": ev.title,
            "type": ev.event_type,
            "start_time": ev.start_time.strftime('%Y-%m-%d %H:%M'),
            "status": ev.status,
            "client": ev.client.name if ev.client else None,
            "client_id": ev.client.client_id if ev.client else None,
            "lead": ev.lead.lead_name if ev.lead else None
        })
    return {"verified_fact": True, "count": len(results), "events": results}


# --- TWO-PHASE CONSEQUENTIAL PROPOSALS ---

def _create_action_proposal(user, conversation, action_type, preview_data, payload):
    token = secrets.token_hex(24)
    expires_at = timezone.now() + timedelta(minutes=30)
    proposal = ActionProposal.objects.create(
        token=token,
        user=user,
        conversation=conversation,
        action_type=action_type,
        preview_data=preview_data,
        payload=payload,
        expires_at=expires_at
    )
    return {
        "requires_confirmation": True,
        "action_token": token,
        "action_type": action_type,
        "preview": preview_data,
        "expires_in_minutes": 30,
        "message": f"Action prepared: {preview_data.get('summary', 'Please confirm to proceed.')}"
    }


def tool_propose_create_lead(user, args, conversation=None):
    email = args.get('email', '').strip().lower()
    lead_name = args.get('lead_name', '').strip()
    if not email or not lead_name:
        return {"error": "Lead name and email are required."}

    # Duplicate check
    existing_lead = Lead.objects.filter(normalized_email=email).first()
    existing_client = Client.objects.filter(normalized_email=email).first()

    warnings = []
    if existing_client:
        warnings.append(f"Client already exists with this email: [{existing_client.client_id}] {existing_client.name}")
    if existing_lead:
        warnings.append(f"Lead already exists with this email: Lead #{existing_lead.id} ({existing_lead.status})")

    preview = {
        "action_title": "Create New Lead",
        "summary": f"Create lead '{lead_name}' ({email}) for service '{args.get('interested_service', 'General Inquiry')}'",
        "lead_name": lead_name,
        "company": args.get('company', ''),
        "email": email,
        "phone": args.get('phone', ''),
        "interested_service": args.get('interested_service', ''),
        "estimated_budget": args.get('estimated_budget'),
        "lead_source": args.get('lead_source', 'Website'),
        "warnings": warnings
    }

    return _create_action_proposal(user, conversation, 'create_lead', preview, args)


def tool_propose_convert_lead(user, lead_id, conversation=None):
    if not user.can_convert_leads():
        return {"error": "Unauthorized: Your role does not have permission to convert leads."}

    lead = Lead.objects.filter(id=lead_id).first()
    if not lead:
        return {"error": f"Lead #{lead_id} does not exist."}

    if lead.converted_client:
        return {"error": f"Lead #{lead_id} is already converted to client [{lead.converted_client.client_id}] {lead.converted_client.name}."}

    # Check potential client duplicate
    dup_client = Client.find_duplicate(lead.email)

    preview = {
        "action_title": "Convert Lead to Client",
        "summary": f"Convert Lead #{lead.id} ({lead.lead_name}) into a centralized Client with unique Client ID.",
        "lead_id": lead.id,
        "lead_name": lead.lead_name,
        "company": lead.company,
        "email": lead.email,
        "phone": lead.phone,
        "service_interests": lead.interested_service,
        "duplicate_warning": f"Existing client found: [{dup_client.client_id}] {dup_client.name}" if dup_client else None
    }

    return _create_action_proposal(user, conversation, 'convert_lead', preview, {"lead_id": lead.id})


def tool_propose_create_task(user, args, conversation=None):
    project_code = args.get('project_code', '').strip()
    title = args.get('title', '').strip()
    if not project_code or not title:
        return {"error": "Project code and task title are required."}

    project = Project.objects.filter(project_code__iexact=project_code).first()
    if not project:
        return {"error": f"Project '{project_code}' not found."}

    assigned_user = None
    assignee_email = args.get('assigned_to_email')
    if assignee_email:
        assigned_user = User.objects.filter(email__iexact=assignee_email.strip()).first()

    preview = {
        "action_title": "Create Project Task",
        "summary": f"Add task '{title}' to project [{project.project_code}] {project.project_name}",
        "project_code": project.project_code,
        "project_name": project.project_name,
        "task_title": title,
        "priority": args.get('priority', 'Medium'),
        "assigned_to": assigned_user.full_name if assigned_user else "Unassigned",
        "deadline": args.get('deadline')
    }

    payload = {
        "project_id": project.id,
        "title": title,
        "description": args.get('description', ''),
        "assigned_to_id": assigned_user.id if assigned_user else None,
        "priority": args.get('priority', 'Medium'),
        "deadline": args.get('deadline')
    }

    return _create_action_proposal(user, conversation, 'create_task', preview, payload)


def tool_propose_schedule_event(user, args, conversation=None):
    title = args.get('title', '').strip()
    start_time_str = args.get('start_time', '').strip()
    if not title or not start_time_str:
        return {"error": "Event title and start time are required."}

    client = None
    client_id = args.get('client_id')
    if client_id:
        client = Client.objects.filter(client_id__iexact=str(client_id).strip()).first()

    lead = None
    lead_id = args.get('lead_id')
    if lead_id:
        lead = Lead.objects.filter(id=lead_id).first()

    preview = {
        "action_title": "Schedule Calendar Event",
        "summary": f"Schedule '{title}' on {start_time_str}",
        "title": title,
        "event_type": args.get('event_type', 'Client Meeting'),
        "start_time": start_time_str,
        "client": f"[{client.client_id}] {client.name}" if client else None,
        "lead": f"Lead #{lead.id} ({lead.lead_name})" if lead else None
    }

    payload = {
        "title": title,
        "event_type": args.get('event_type', 'Client Meeting'),
        "start_time": start_time_str,
        "client_id": client.id if client else None,
        "lead_id": lead.id if lead else None
    }

    return _create_action_proposal(user, conversation, 'schedule_event', preview, payload)


def tool_propose_draft_quotation(user, args, conversation=None):
    client_id = args.get('client_id', '').strip()
    title = args.get('title', 'Project Quotation').strip()
    items = args.get('items', [])

    client = Client.objects.filter(Q(client_id__iexact=client_id) | Q(id__iexact=client_id)).first()
    if not client:
        return {"error": f"Client with ID '{client_id}' not found. Please provide a valid Client ID."}

    if not items:
        return {"error": "At least one item is required to draft a quotation."}

    calculated_subtotal = Decimal('0.00')
    clean_items = []
    for itm in items:
        qty = Decimal(str(itm.get('quantity', 1)))
        price = Decimal(str(itm.get('unit_price', 0)))
        line_total = qty * price
        calculated_subtotal += line_total
        clean_items.append({
            "description": itm.get('description', ''),
            "quantity": str(qty),
            "unit_price": str(price),
            "total": str(line_total)
        })

    currency = args.get('currency', 'PKR')
    preview = {
        "action_title": "Draft New Quotation",
        "summary": f"Create Draft Quotation '{title}' for [{client.client_id}] {client.name} totaling {currency} {calculated_subtotal:,.2f}",
        "client_id": client.client_id,
        "client_name": client.name,
        "title": title,
        "currency": currency,
        "subtotal": str(calculated_subtotal),
        "item_count": len(clean_items),
        "items": clean_items
    }

    payload = {
        "client_id": client.id,
        "title": title,
        "currency": currency,
        "items": clean_items
    }

    return _create_action_proposal(user, conversation, 'draft_quotation', preview, payload)


# --- ATOMIC ACTION EXECUTOR ---

def execute_action_proposal(user, token):
    """
    Executes a confirmed ActionProposal atomically within a DB transaction.
    Re-validates permissions and record constraints.
    """
    proposal = ActionProposal.objects.filter(token=token).first()
    if not proposal:
        return {"success": False, "error": "Invalid action token."}

    if not proposal.is_valid():
        return {"success": False, "error": f"Action cannot be executed. Current status: {proposal.status}."}

    # Ownership check
    if proposal.user != user and not user.is_administrator:
        return {"success": False, "error": "Unauthorized: You did not initiate this action proposal."}

    with transaction.atomic():
        action_type = proposal.action_type
        payload = proposal.payload
        result = {}

        if action_type == 'create_lead':
            lead = Lead.objects.create(
                lead_name=payload.get('lead_name'),
                email=payload.get('email'),
                phone=payload.get('phone', ''),
                company=payload.get('company', ''),
                interested_service=payload.get('interested_service', ''),
                estimated_budget=Decimal(str(payload.get('estimated_budget'))) if payload.get('estimated_budget') else None,
                lead_source=payload.get('lead_source', 'Website'),
                assigned_salesperson=user if user.is_salesperson else None
            )
            record_audit_log(
                user=user,
                action='AI_CREATE_LEAD',
                module='LEADS',
                entity_id=str(lead.id),
                description=f"AI Assistant created lead '{lead.lead_name}' ({lead.email})"
            )
            result = {
                "message": f"Lead #{lead.id} ({lead.lead_name}) created successfully.",
                "lead_id": lead.id,
                "view_url": f"/leads/{lead.id}"
            }

        elif action_type == 'convert_lead':
            if not user.can_convert_leads():
                raise ValidationError("Unauthorized to convert leads.")

            lead = Lead.objects.select_for_update().get(id=payload.get('lead_id'))
            if lead.converted_client:
                return {"success": False, "error": "Lead is already converted."}

            client = Client.objects.create(
                name=lead.lead_name,
                company_name=lead.company,
                email=lead.email,
                phone=lead.phone,
                service_interests=lead.interested_service,
                client_status=Client.Status.LEAD_CONVERTED,
                created_by=user
            )
            lead.status = Lead.Status.WON
            lead.converted_client = client
            lead.save(update_fields=['status', 'converted_client'])

            ClientActivity.objects.create(
                client=client,
                user=user,
                action_type="CONVERTED_FROM_LEAD",
                description=f"Converted by {user.full_name} via AI Assistant from Lead #{lead.id}."
            )

            record_audit_log(
                user=user,
                action='AI_CONVERT_LEAD',
                module='CLIENTS',
                entity_id=client.client_id,
                description=f"AI Assistant converted Lead #{lead.id} to Client [{client.client_id}] {client.name}"
            )
            result = {
                "message": f"Lead converted successfully! Centralized Client [{client.client_id}] {client.name} created.",
                "client_id": client.client_id,
                "view_url": f"/clients"
            }

        elif action_type == 'create_task':
            project = Project.objects.get(id=payload.get('project_id'))
            assignee = User.objects.filter(id=payload.get('assigned_to_id')).first() if payload.get('assigned_to_id') else None

            task = Task.objects.create(
                project=project,
                title=payload.get('title'),
                description=payload.get('description', ''),
                assigned_to=assignee,
                priority=payload.get('priority', 'Medium'),
                deadline=payload.get('deadline') or None,
                created_by=user
            )

            record_audit_log(
                user=user,
                action='AI_CREATE_TASK',
                module='PROJECTS',
                entity_id=str(task.id),
                description=f"AI Assistant created task '{task.title}' in [{project.project_code}]"
            )
            result = {
                "message": f"Task '{task.title}' created in project {project.project_code}.",
                "task_id": task.id,
                "project_code": project.project_code,
                "view_url": f"/projects"
            }

        elif action_type == 'schedule_event':
            client = Client.objects.filter(id=payload.get('client_id')).first() if payload.get('client_id') else None
            lead = Lead.objects.filter(id=payload.get('lead_id')).first() if payload.get('lead_id') else None

            event = CalendarEvent.objects.create(
                title=payload.get('title'),
                event_type=payload.get('event_type', 'Client Meeting'),
                start_time=payload.get('start_time'),
                client=client,
                lead=lead,
                assigned_to=user,
                created_by=user
            )

            record_audit_log(
                user=user,
                action='AI_SCHEDULE_EVENT',
                module='CALENDAR',
                entity_id=str(event.id),
                description=f"AI Assistant scheduled event '{event.title}' on {event.start_time}"
            )
            result = {
                "message": f"Event '{event.title}' scheduled on {event.start_time}.",
                "event_id": event.id,
                "view_url": f"/calendar"
            }

        elif action_type == 'draft_quotation':
            client = Client.objects.get(id=payload.get('client_id'))
            quotation = Quotation.objects.create(
                title=payload.get('title', 'Project Quotation'),
                client=client,
                salesperson=user,
                currency=payload.get('currency', 'PKR'),
                status=Quotation.Status.DRAFT
            )

            items_data = payload.get('items', [])
            for itm in items_data:
                QuotationItem.objects.create(
                    quotation=quotation,
                    description=itm.get('description'),
                    quantity=Decimal(str(itm.get('quantity', 1))),
                    unit_price=Decimal(str(itm.get('unit_price', 0)))
                )
            quotation.calculate_totals()

            record_audit_log(
                user=user,
                action='AI_DRAFT_QUOTATION',
                module='QUOTATIONS',
                entity_id=quotation.quotation_number,
                description=f"AI Assistant created draft quotation {quotation.quotation_number} for [{client.client_id}]"
            )
            result = {
                "message": f"Draft Quotation {quotation.quotation_number} created with {quotation.items.count()} items totaling {quotation.currency} {quotation.total_amount:,.2f}.",
                "quotation_number": quotation.quotation_number,
                "view_url": f"/quotations"
            }

        else:
            return {"success": False, "error": f"Unknown action type '{action_type}'."}

        proposal.status = ActionProposal.Status.EXECUTED
        proposal.execution_result = result
        proposal.save(update_fields=['status', 'execution_result'])

        return {"success": True, "result": result}
