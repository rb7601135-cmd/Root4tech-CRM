"""
Root4Tech CRM - Initial Database Seeding Management Command.
Creates staff roles, groups, staff users, admin, services, clients, leads,
projects, tasks, follow-ups, invoices, quotations, and notifications.
"""

from django.core.management.base import BaseCommand
from django.contrib.auth.models import User, Group, Permission
from django.utils import timezone
from datetime import timedelta, date
from decimal import Decimal

from crm.models import (
    StaffProfile, Service, Client, Lead, Project, Task,
    FollowUp, Quotation, Invoice, BillingItem, Payment,
    Notification, ActivityLog
)


class Command(BaseCommand):
    help = 'Seeds initial Root4Tech CRM staff roles, clients, leads, and operational data.'

    def handle(self, *args, **options):
        self.stdout.write(self.style.NOTICE('Starting database seed...'))

        # 1. Create Django Groups
        groups = {
            'Sales Manager': 'sales_mgr',
            'Salesperson': 'sales',
            'Full-Stack Developer': 'dev',
            'Video Editor': 'editor',
            'System Administrator': 'admin',
        }
        group_objs = {}
        for group_name, role_key in groups.items():
            g, created = Group.objects.get_or_create(name=group_name)
            group_objs[role_key] = g
            if created:
                self.stdout.write(f"Created group: {group_name}")

        # 2. Create Users & Staff Profiles
        staff_data = [
            {
                'username': 'admin',
                'first_name': 'Admin',
                'last_name': 'Supervisor',
                'email': 'admin@root4tech.com',
                'password': 'adminpassword123',
                'is_staff': True,
                'is_superuser': True,
                'role_key': 'admin',
                'role_title': 'Agency Administrator',
                'phone': '+1 (555) 010-0001',
                'avatar': 'AD',
                'color': '#0f172a',
                'skills': ['Agency Operations', 'System Admin', 'Security', 'Finances'],
            },
            {
                'username': 'david',
                'first_name': 'David',
                'last_name': 'Vance',
                'email': 'david@root4tech.com',
                'password': 'password123',
                'is_staff': True,
                'is_superuser': False,
                'role_key': 'sales_mgr',
                'role_title': 'Sales Manager',
                'phone': '+1 (555) 492-1144',
                'avatar': 'DV',
                'color': '#059669',
                'skills': ['Pipeline Strategy', 'Client Acquisition', 'Deal Negotiation', 'Agency Growth'],
            },
            {
                'username': 'sarah',
                'first_name': 'Sarah',
                'last_name': 'Jenkins',
                'email': 'sarah@root4tech.com',
                'password': 'password123',
                'is_staff': True,
                'is_superuser': False,
                'role_key': 'sales',
                'role_title': 'Salesperson',
                'phone': '+1 (555) 603-8820',
                'avatar': 'SJ',
                'color': '#d97706',
                'skills': ['Outbound Prospecting', 'Discovery Calls', 'Proposal Drafting', 'CRM Follow-ups'],
            },
            {
                'username': 'alex',
                'first_name': 'Alex',
                'last_name': 'Turner',
                'email': 'alex@root4tech.com',
                'password': 'password123',
                'is_staff': True,
                'is_superuser': False,
                'role_key': 'dev',
                'role_title': 'Full-Stack Developer',
                'phone': '+1 (555) 349-2180',
                'avatar': 'AT',
                'color': '#2563eb',
                'skills': ['React', 'Node.js', 'Django', 'PostgreSQL', 'AWS Cloud'],
            },
            {
                'username': 'maya',
                'first_name': 'Maya',
                'last_name': 'Lin',
                'email': 'maya@root4tech.com',
                'password': 'password123',
                'is_staff': True,
                'is_superuser': False,
                'role_key': 'editor',
                'role_title': 'Video Editor',
                'phone': '+1 (555) 781-9921',
                'avatar': 'ML',
                'color': '#7e22ce',
                'skills': ['Premiere Pro', 'After Effects', 'DaVinci Resolve', '3D Motion', 'Sound Design'],
            },
        ]

        users = {}
        for s in staff_data:
            user = User.objects.filter(username=s['username']).first()
            if not user:
                user = User.objects.create_user(
                    username=s['username'],
                    email=s['email'],
                    password=s['password'],
                    first_name=s['first_name'],
                    last_name=s['last_name'],
                    is_staff=s['is_staff'],
                    is_superuser=s['is_superuser'],
                )
                self.stdout.write(f"Created user: {user.username} ({s['email']})")
            else:
                user.set_password(s['password'])
                user.first_name = s['first_name']
                user.last_name = s['last_name']
                user.email = s['email']
                user.is_staff = s['is_staff']
                user.is_superuser = s['is_superuser']
                user.save()

            # Assign Group
            group_obj = group_objs.get(s['role_key'])
            if group_obj:
                user.groups.add(group_obj)

            # Profile
            profile, _ = StaffProfile.objects.get_or_create(user=user)
            profile.role_key = s['role_key']
            profile.role_title = s['role_title']
            profile.phone = s['phone']
            profile.avatar = s['avatar']
            profile.color = s['color']
            profile.skills = s['skills']
            profile.status = 'Active'
            profile.save()

            users[s['role_key']] = user

        # 3. Seed Services
        services_data = [
            {'name': 'Website Development', 'category': 'Development', 'price': Decimal('5500.00'), 'unit': 'per project', 'description': 'Custom responsive web applications, frontend portals & Django API backends.'},
            {'name': 'Video Editing', 'category': 'Video Production', 'price': Decimal('2500.00'), 'unit': 'per video / campaign', 'description': 'Commercial 4K edits, color grading, sound design & social cutdowns.'},
            {'name': 'Branding', 'category': 'Creative Design', 'price': Decimal('3500.00'), 'unit': 'per package', 'description': 'Full brand identity systems, typography, color guides & logo assets.'},
            {'name': 'Graphic Design', 'category': 'Creative Design', 'price': Decimal('1800.00'), 'unit': 'monthly retainer / assets', 'description': 'Marketing collateral, pitch decks, ad creatives & social media banners.'},
            {'name': 'Digital Marketing', 'category': 'Marketing', 'price': Decimal('3000.00'), 'unit': 'monthly retainer', 'description': 'Performance advertising (PPC), search engine optimization (SEO) & funnel strategy.'},
        ]

        services = {}
        for s in services_data:
            svc, created = Service.objects.get_or_create(
                name=s['name'],
                defaults=s
            )
            services[s['name']] = svc
            if created:
                self.stdout.write(f"Created Service: {svc.name}")

        # 4. Seed Clients
        clients_data = [
            {'company': 'OmniTrade FinTech', 'contact_person': 'Kenneth Wright', 'email': 'k.wright@omnitrade.io', 'phone': '+1 (555) 019-4820', 'industry': 'Financial Technology', 'total_spent': Decimal('24500.00'), 'status': 'Active'},
            {'company': 'PulseWear Fitness', 'contact_person': 'Sarah Chen', 'email': 'sarah@pulsewear.com', 'phone': '+1 (555) 782-9011', 'industry': 'Health & Fitness Wearable', 'total_spent': Decimal('14200.00'), 'status': 'Active'},
            {'company': 'Aurora AI Labs', 'contact_person': 'Dr. Evelyn Reed', 'email': 'e.reed@aurora-ai.io', 'phone': '+1 (555) 431-8899', 'industry': 'Artificial Intelligence', 'total_spent': Decimal('32000.00'), 'status': 'Active'},
            {'company': 'GreenScape Organics', 'contact_person': 'Marcus Brody', 'email': 'marcus@greenscape.co', 'phone': '+1 (555) 234-1188', 'industry': 'E-Commerce / Consumer Goods', 'total_spent': Decimal('8900.00'), 'status': 'Active'},
        ]

        clients = {}
        for c in clients_data:
            client, created = Client.objects.get_or_create(
                company=c['company'],
                defaults={
                    'contact_person': c['contact_person'],
                    'email': c['email'],
                    'phone': c['phone'],
                    'industry': c['industry'],
                    'total_spent': c['total_spent'],
                    'status': c['status'],
                    'account_manager': users['sales_mgr'],
                }
            )
            clients[c['company']] = client
            if created:
                self.stdout.write(f"Created Client: {client.company}")

        # 5. Seed Leads
        leads_data = [
            {
                'name': 'Marcus Sterling',
                'company': 'Apex Horizon Ventures',
                'email': 'm.sterling@apexhorizon.com',
                'phone': '+1 (555) 234-8901',
                'service_required': 'Website Development',
                'lead_source': 'LinkedIn Campaign',
                'assigned_salesperson': users['sales'],
                'estimated_deal_value': Decimal('12500.00'),
                'stage': 'Qualified',
                'status': 'Active',
                'next_follow_up': date.today() + timedelta(days=2),
                'notes': 'Needs enterprise Next.js/Django portal with custom client analytics.',
            },
            {
                'name': 'Elena Rostova',
                'company': 'Nordic Glow Skincare',
                'email': 'elena@nordicglow.co',
                'phone': '+1 (555) 872-4512',
                'service_required': 'Video Editing',
                'lead_source': 'Website Inquiry',
                'assigned_salesperson': users['sales_mgr'],
                'estimated_deal_value': Decimal('6200.00'),
                'stage': 'Proposal Sent',
                'status': 'Active',
                'next_follow_up': date.today() + timedelta(days=1),
                'notes': 'Requires 12 TikTok/Reels brand ads and 2 4K YouTube product reels.',
            },
            {
                'name': 'Julian Hayes',
                'company': 'Quantum Logistics',
                'email': 'julian@quantumlogistics.io',
                'phone': '+1 (555) 902-3341',
                'service_required': 'Website Development',
                'lead_source': 'Referral',
                'assigned_salesperson': users['sales'],
                'estimated_deal_value': Decimal('18000.00'),
                'stage': 'Contacted',
                'status': 'Active',
                'next_follow_up': date.today() + timedelta(days=4),
                'notes': 'Fleet dispatch automation web dashboard & driver mobile portal.',
            },
            {
                'name': 'Samantha Wu',
                'company': 'CloudFlow Systems',
                'email': 'swu@cloudflow.tech',
                'phone': '+1 (555) 671-2244',
                'service_required': 'Digital Marketing',
                'lead_source': 'Outbound Cold Email',
                'assigned_salesperson': users['sales_mgr'],
                'estimated_deal_value': Decimal('9500.00'),
                'stage': 'Won',
                'status': 'Won',
                'is_converted': True,
                'notes': 'Converted to Client on launch kickoff.',
            },
            {
                'name': 'Robert Vance',
                'company': 'BioGenesis Pharma',
                'email': 'rvance@biogenesis.org',
                'phone': '+1 (555) 441-9922',
                'service_required': 'Branding',
                'lead_source': 'Event / Conference',
                'assigned_salesperson': users['sales'],
                'estimated_deal_value': Decimal('15000.00'),
                'stage': 'New',
                'status': 'Active',
                'next_follow_up': date.today() + timedelta(days=3),
                'notes': 'Rebranding complete identity and clinical conference booth creatives.',
            },
        ]

        for ld in leads_data:
            Lead.objects.get_or_create(
                company=ld['company'],
                defaults=ld
            )

        # 6. Seed Projects
        projects_data = [
            {
                'title': 'OmniTrade Web Trading Terminal',
                'client': clients['OmniTrade FinTech'],
                'service': services['Website Development'],
                'project_type': 'Development',
                'status': 'Active',
                'priority': 'High',
                'progress': 72,
                'budget': Decimal('16500.00'),
                'deadline': date.today() + timedelta(days=18),
                'tech_stack': ['React', 'Django', 'Tailwind', 'PostgreSQL', 'WebSockets'],
                'notes': 'Real-time WebSocket streaming with institutional security compliance.',
                'staff': [users['dev']],
            },
            {
                'title': 'PulseWear Q4 Product Launch Commercials',
                'client': clients['PulseWear Fitness'],
                'service': services['Video Editing'],
                'project_type': 'Video Production',
                'status': 'In Review',
                'priority': 'Urgent',
                'progress': 90,
                'budget': Decimal('6800.00'),
                'deadline': date.today() + timedelta(days=5),
                'tech_stack': ['Premiere Pro', 'After Effects', 'DaVinci Resolve', '4K RAW'],
                'notes': 'Final revision round on Sound Mix & TikTok aspect ratios.',
                'preview_link': 'https://vimeo.com/demo/pulsewear-v3',
                'staff': [users['editor']],
            },
            {
                'title': 'Aurora AI Analytics Dashboard',
                'client': clients['Aurora AI Labs'],
                'service': services['Website Development'],
                'project_type': 'Development',
                'status': 'Active',
                'priority': 'Medium',
                'progress': 45,
                'budget': Decimal('22000.00'),
                'deadline': date.today() + timedelta(days=35),
                'tech_stack': ['React', 'Python', 'FastAPI', 'Chart.js'],
                'notes': 'Client requested custom dark theme data charts & CSV exports.',
                'staff': [users['dev']],
            },
        ]

        for p_data in projects_data:
            staff_members = p_data.pop('staff')
            proj, created = Project.objects.get_or_create(
                title=p_data['title'],
                client=p_data['client'],
                defaults=p_data
            )
            proj.assigned_staff.set(staff_members)
            if created:
                self.stdout.write(f"Created Project: {proj.title}")

        # 7. Seed Tasks
        alex_tasks = [
            {'title': 'Implement WebSocket live order book feed', 'priority': 'High', 'status': 'In Progress', 'due_date': date.today() + timedelta(days=3)},
            {'title': 'Configure JWT refresh token cookie security', 'priority': 'High', 'status': 'Completed', 'due_date': date.today() - timedelta(days=2)},
            {'title': 'Build analytics chart export in Aurora AI portal', 'priority': 'Medium', 'status': 'Pending', 'due_date': date.today() + timedelta(days=7)},
            {'title': 'Resolve Django ORM N+1 query issue on lead list API', 'priority': 'Low', 'status': 'Pending', 'due_date': date.today() + timedelta(days=5)},
        ]
        for t in alex_tasks:
            Task.objects.get_or_create(
                title=t['title'],
                assigned_to=users['dev'],
                defaults={
                    'priority': t['priority'],
                    'status': t['status'],
                    'due_date': t['due_date'],
                    'notes': 'Assigned to Alex Turner (Full-Stack Dev).'
                }
            )

        maya_tasks = [
            {'title': 'Color grade 4K Gym Master shot in DaVinci', 'priority': 'High', 'status': 'In Progress', 'due_date': date.today() + timedelta(days=1)},
            {'title': 'Produce 9:16 vertical cutdowns for Instagram Reels', 'priority': 'High', 'status': 'Pending', 'due_date': date.today() + timedelta(days=2)},
            {'title': 'Export master audio with -14 LUFS broadcast standard', 'priority': 'Medium', 'status': 'Pending', 'due_date': date.today() + timedelta(days=3)},
        ]
        for t in maya_tasks:
            Task.objects.get_or_create(
                title=t['title'],
                assigned_to=users['editor'],
                defaults={
                    'priority': t['priority'],
                    'status': t['status'],
                    'due_date': t['due_date'],
                    'notes': 'Assigned to Maya Lin (Video Editor).'
                }
            )

        # 8. Seed Follow-Ups
        followups = [
            {
                'lead': Lead.objects.filter(company='Apex Horizon Ventures').first(),
                'scheduled_date': date.today() + timedelta(days=2),
                'followup_type': 'Demo',
                'assigned_to': users['sales'],
                'status': 'Scheduled',
                'notes': 'Present interactive Figma UX prototypes to investment partners.'
            },
            {
                'lead': Lead.objects.filter(company='Nordic Glow Skincare').first(),
                'scheduled_date': date.today() + timedelta(days=1),
                'followup_type': 'Call',
                'assigned_to': users['sales_mgr'],
                'status': 'Scheduled',
                'notes': 'Review quotation QTN-2026-082 deliverables and schedule kickoff.'
            },
        ]
        for f in followups:
            if f['lead']:
                FollowUp.objects.get_or_create(
                    lead=f['lead'],
                    scheduled_date=f['scheduled_date'],
                    defaults=f
                )

        # 9. Seed Invoices & Quotations
        inv1, _ = Invoice.objects.get_or_create(
            invoice_number='INV-2026-081',
            defaults={
                'client': clients['OmniTrade FinTech'],
                'project_scope_title': 'OmniTrade Web Trading Terminal & Cloud Engine',
                'created_by': users['sales_mgr'],
                'issue_date': date.today() - timedelta(days=25),
                'due_date': date.today() + timedelta(days=5),
                'amount': Decimal('12000.00'),
                'paid_amount': Decimal('12000.00'),
                'status': 'Paid',
                'notes': 'Paid in full via Wire Transfer.',
            }
        )
        BillingItem.objects.get_or_create(
            invoice=inv1,
            description='Web Architecture & Trading Terminal UI',
            defaults={'quantity': Decimal('1.0'), 'unit_rate': Decimal('8500.00'), 'total': Decimal('8500.00'), 'service': services['Website Development']}
        )
        BillingItem.objects.get_or_create(
            invoice=inv1,
            description='Backend Django API & High-Frequency WebSockets',
            defaults={'quantity': Decimal('1.0'), 'unit_rate': Decimal('3500.00'), 'total': Decimal('3500.00'), 'service': services['Website Development']}
        )
        Payment.objects.get_or_create(
            invoice=inv1,
            defaults={
                'amount': Decimal('12000.00'),
                'payment_date': date.today() - timedelta(days=10),
                'payment_method': 'Wire Transfer',
                'reference_number': 'SWIFT-ROOT4-88391',
                'recorded_by': users['sales_mgr']
            }
        )

        inv2, _ = Invoice.objects.get_or_create(
            invoice_number='INV-2026-082',
            defaults={
                'client': clients['PulseWear Fitness'],
                'project_scope_title': 'PulseWear Q4 Video Production & Motion Identity',
                'created_by': users['sales_mgr'],
                'issue_date': date.today() - timedelta(days=12),
                'due_date': date.today() + timedelta(days=18),
                'amount': Decimal('6800.00'),
                'paid_amount': Decimal('0.00'),
                'status': 'Sent',
                'notes': 'Sent to client accounting department.',
            }
        )
        BillingItem.objects.get_or_create(
            invoice=inv2,
            description='4K Commercial Video Editing & DaVinci Color Grading',
            defaults={'quantity': Decimal('2.0'), 'unit_rate': Decimal('2500.00'), 'total': Decimal('5000.00'), 'service': services['Video Editing']}
        )
        BillingItem.objects.get_or_create(
            invoice=inv2,
            description='Social Media Ad Campaign Cutdowns (Reels/TikTok)',
            defaults={'quantity': Decimal('1.0'), 'unit_rate': Decimal('1800.00'), 'total': Decimal('1800.00'), 'service': services['Graphic Design']}
        )

        # Quotations
        qtn1, _ = Quotation.objects.get_or_create(
            quotation_number='QTN-2026-081',
            defaults={
                'client': clients['Aurora AI Labs'],
                'project_scope_title': 'Enterprise AI Dashboard & Brand Collateral',
                'created_by': users['sales_mgr'],
                'issue_date': date.today() - timedelta(days=8),
                'valid_until': date.today() + timedelta(days=22),
                'amount': Decimal('22000.00'),
                'status': 'Sent',
                'notes': 'Valid for 30 calendar days.',
            }
        )
        BillingItem.objects.get_or_create(
            quotation=qtn1,
            description='Next.js / Django Cloud Analytics Portal',
            defaults={'quantity': Decimal('1.0'), 'unit_rate': Decimal('16500.00'), 'total': Decimal('16500.00'), 'service': services['Website Development']}
        )
        BillingItem.objects.get_or_create(
            quotation=qtn1,
            description='Brand Identity & Design System',
            defaults={'quantity': Decimal('1.0'), 'unit_rate': Decimal('5500.00'), 'total': Decimal('5500.00'), 'service': services['Branding']}
        )

        # 10. Seed Notifications
        notifications_data = [
            {'title': 'New Lead Inquiry Received', 'message': 'Marcus Sterling submitted an inquiry for Website Development ($12,500).', 'category': 'sales', 'role_target': 'all'},
            {'title': 'Invoice Payment Received', 'message': 'OmniTrade FinTech paid $12,000 for Statement INV-2026-081.', 'category': 'billing', 'role_target': 'sales_mgr'},
            {'title': 'Project Milestone In Review', 'message': 'Maya Lin submitted PulseWear Q4 Commercial for client preview.', 'category': 'project', 'role_target': 'all'},
        ]
        for notif in notifications_data:
            Notification.objects.get_or_create(
                title=notif['title'],
                defaults=notif
            )

        # 11. Seed Activity Logs
        ActivityLog.objects.create(
            user=users['admin'],
            action='System Initialization',
            entity_type='System',
            entity_id='SYS-01',
            details='Database initialized with staff profiles, service catalogs, and sample client data.'
        )

        self.stdout.write(self.style.SUCCESS('[SUCCESS] Database seeded successfully with all Root4Tech CRM entities!'))
