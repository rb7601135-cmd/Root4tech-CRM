"""
Root4Tech CRM - Automated Test Suite (Phase 2 Backend).
Tests for:
- Models & Relationships
- Authentication & Sessions
- Role-based Permissions for all 4 Staff Roles + Admin
- Safe Lead Conversion without Duplicate Clients
- CRUD API Operations (Leads, Clients, Projects, Tasks, Invoices)
- Frontend Hydration Data Bundle
"""

from django.test import TestCase, Client as HttpClient
from django.contrib.auth.models import User, Group
from django.utils import timezone
from django.core.management import call_command
from datetime import date, timedelta
from decimal import Decimal
import json

from crm.models import (
    StaffProfile, Service, Client, Lead, Project, Task,
    FollowUp, Quotation, Invoice, BillingItem, Payment,
    Notification, ActivityLog, AgencySetting
)
from crm.pdf_generator import generate_invoice_pdf, generate_quotation_pdf



class Root4TechCRMTestCase(TestCase):
    def setUp(self):
        self.client = HttpClient()

        # Create Groups
        self.group_sales_mgr, _ = Group.objects.get_or_create(name='Sales Manager')
        self.group_sales, _ = Group.objects.get_or_create(name='Salesperson')
        self.group_dev, _ = Group.objects.get_or_create(name='Full-Stack Developer')
        self.group_editor, _ = Group.objects.get_or_create(name='Video Editor')

        # 1. Sales Manager (David)
        self.user_sales_mgr = User.objects.create_user(
            username='david',
            email='david@root4tech.com',
            password='password123',
            first_name='David',
            last_name='Vance'
        )
        self.user_sales_mgr.groups.add(self.group_sales_mgr)
        self.profile_sales_mgr = StaffProfile.objects.create(
            user=self.user_sales_mgr,
            role_key='sales_mgr',
            role_title='Sales Manager',
            phone='+1 (555) 492-1144',
            avatar='DV',
            color='#059669',
            skills=['Pipeline Strategy', 'Deal Negotiation']
        )

        # 2. Salesperson (Sarah)
        self.user_sales = User.objects.create_user(
            username='sarah',
            email='sarah@root4tech.com',
            password='password123',
            first_name='Sarah',
            last_name='Jenkins'
        )
        self.user_sales.groups.add(self.group_sales)
        self.profile_sales = StaffProfile.objects.create(
            user=self.user_sales,
            role_key='sales',
            role_title='Salesperson',
            phone='+1 (555) 603-8820',
            avatar='SJ',
            color='#d97706',
            skills=['Discovery Calls', 'Outbound Sales']
        )

        # 3. Developer (Alex)
        self.user_dev = User.objects.create_user(
            username='alex',
            email='alex@root4tech.com',
            password='password123',
            first_name='Alex',
            last_name='Turner'
        )
        self.user_dev.groups.add(self.group_dev)
        self.profile_dev = StaffProfile.objects.create(
            user=self.user_dev,
            role_key='dev',
            role_title='Full-Stack Developer',
            phone='+1 (555) 349-2180',
            avatar='AT',
            color='#2563eb',
            skills=['React', 'Django', 'PostgreSQL']
        )

        # 4. Video Editor (Maya)
        self.user_editor = User.objects.create_user(
            username='maya',
            email='maya@root4tech.com',
            password='password123',
            first_name='Maya',
            last_name='Lin'
        )
        self.user_editor.groups.add(self.group_editor)
        self.profile_editor = StaffProfile.objects.create(
            user=self.user_editor,
            role_key='editor',
            role_title='Video Editor',
            phone='+1 (555) 781-9921',
            avatar='ML',
            color='#7e22ce',
            skills=['Premiere Pro', 'After Effects']
        )

        # 5. Superuser Admin
        self.user_admin = User.objects.create_superuser(
            username='admin',
            email='admin@root4tech.com',
            password='adminpassword123',
            first_name='System',
            last_name='Admin'
        )
        self.profile_admin = StaffProfile.objects.create(
            user=self.user_admin,
            role_key='admin',
            role_title='Agency Administrator'
        )

        # Seed Core Services
        self.service_dev = Service.objects.create(
            name='Website Development',
            category='Development',
            price=Decimal('5500.00'),
            unit='per project'
        )
        self.service_video = Service.objects.create(
            name='Video Editing',
            category='Video Production',
            price=Decimal('2500.00'),
            unit='per video'
        )

        # Seed Client
        self.client_omni = Client.objects.create(
            company='OmniTrade FinTech',
            contact_person='Kenneth Wright',
            email='k.wright@omnitrade.io',
            total_spent=Decimal('12000.00')
        )

        # Seed Projects
        self.project_dev = Project.objects.create(
            title='OmniTrade Web Terminal',
            client=self.client_omni,
            service=self.service_dev,
            project_type='Development',
            status='Active',
            budget=Decimal('15000.00'),
            progress=50
        )
        self.project_dev.assigned_staff.add(self.user_dev)

        self.project_video = Project.objects.create(
            title='PulseWear Commercial Cut',
            client=self.client_omni,
            service=self.service_video,
            project_type='Video Production',
            status='In Review',
            budget=Decimal('6000.00'),
            progress=85
        )
        self.project_video.assigned_staff.add(self.user_editor)
        self.proj_omni = self.project_dev

        # Seed Lead
        self.lead_acme = Lead.objects.create(
            name='Arthur Pendelton',
            company='Acme Corp',
            email='arthur@acmecorp.com',
            service_required='Website Development',
            estimated_deal_value=Decimal('8500.00'),
            stage='Contacted',
            assigned_salesperson=self.user_sales
        )

        # Seed Quotation
        self.qtn_omni = Quotation.objects.create(
            client=self.client_omni,
            project_scope_title='OmniTrade Portal Redesign',
            created_by=self.user_sales_mgr,
            valid_until=date.today() + timedelta(days=30),
            subtotal=Decimal('10000.00'),
            tax_rate=Decimal('10.0'),
            amount=Decimal('11000.00'),
            status='Sent'
        )
        BillingItem.objects.create(
            quotation=self.qtn_omni,
            description='Architecture & Design',
            quantity=Decimal('1.0'),
            unit_rate=Decimal('5000.00')
        )
        BillingItem.objects.create(
            quotation=self.qtn_omni,
            description='Frontend Implementation',
            quantity=Decimal('1.0'),
            unit_rate=Decimal('5000.00')
        )

        # Seed Invoice
        self.inv_omni = Invoice.objects.create(
            client=self.client_omni,
            project_scope_title='OmniTrade Portal Milestone 1',
            created_by=self.user_sales_mgr,
            due_date=date.today() + timedelta(days=15),
            subtotal=Decimal('5000.00'),
            tax_rate=Decimal('10.0'),
            amount=Decimal('5500.00'),
            status='Sent'
        )
        BillingItem.objects.create(
            invoice=self.inv_omni,
            description='Milestone 1 Core Development',
            quantity=Decimal('1.0'),
            unit_rate=Decimal('5000.00')
        )


# =============================================================================
# 1. Model & Relationship Tests
# =============================================================================
class ModelTests(Root4TechCRMTestCase):
    def test_staff_profile_properties(self):
        self.assertEqual(self.profile_dev.full_name, 'Alex Turner')
        self.assertEqual(self.profile_dev.email, 'alex@root4tech.com')
        self.assertEqual(self.profile_dev.active_projects_count, 1)

    def test_service_auto_id(self):
        self.assertTrue(self.service_dev.service_id.startswith('SVC-'))

    def test_client_auto_id(self):
        self.assertTrue(self.client_omni.client_id.startswith('CLI-'))

    def test_billing_item_total_calculation(self):
        inv = Invoice.objects.create(
            client=self.client_omni,
            project_scope_title='Scope Test',
            created_by=self.user_sales_mgr,
            due_date=date.today() + timedelta(days=30),
            amount=Decimal('11000.00')
        )
        item = BillingItem.objects.create(
            invoice=inv,
            description='2x Video Editing',
            quantity=Decimal('2.0'),
            unit_rate=Decimal('2500.00')
        )
        self.assertEqual(item.total, Decimal('5000.00'))

    def test_payment_updates_invoice_status(self):
        inv = Invoice.objects.create(
            client=self.client_omni,
            project_scope_title='Full Payment Test',
            created_by=self.user_sales_mgr,
            due_date=date.today() + timedelta(days=15),
            amount=Decimal('5000.00'),
            status='Sent'
        )
        Payment.objects.create(
            invoice=inv,
            amount=Decimal('5000.00'),
            payment_date=date.today(),
            recorded_by=self.user_sales_mgr
        )
        inv.refresh_from_db()
        self.assertEqual(inv.status, 'Paid')
        self.assertEqual(inv.paid_amount, Decimal('5000.00'))


# =============================================================================
# 2. Lead Conversion & Anti-Duplicate Tests
# =============================================================================
class LeadConversionTests(Root4TechCRMTestCase):
    def test_lead_to_new_client_conversion(self):
        lead = Lead.objects.create(
            name='Marcus Sterling',
            company='Apex Horizon Ventures',
            email='m.sterling@apexhorizon.com',
            estimated_deal_value=Decimal('12500.00'),
            stage='Qualified',
            assigned_salesperson=self.user_sales
        )
        client = lead.convert_to_client(user=self.user_sales)
        self.assertIsNotNone(client)
        self.assertEqual(client.company, 'Apex Horizon Ventures')
        self.assertEqual(client.total_spent, Decimal('12500.00'))

        lead.refresh_from_db()
        self.assertEqual(lead.stage, 'Won')
        self.assertEqual(lead.status, 'Won')
        self.assertTrue(lead.is_converted)
        self.assertEqual(lead.converted_client, client)

    def test_lead_conversion_prevents_duplicate_client_company(self):
        # Lead for an existing client company
        lead = Lead.objects.create(
            name='New Contact',
            company='OmniTrade FinTech',  # Existing company in setUp
            email='new@omnitrade.io',
            estimated_deal_value=Decimal('8000.00'),
            stage='Proposal Sent'
        )
        initial_client_count = Client.objects.filter(company='OmniTrade FinTech').count()
        client = lead.convert_to_client(user=self.user_sales_mgr)

        # Must not create a duplicate client record
        self.assertEqual(Client.objects.filter(company='OmniTrade FinTech').count(), initial_client_count)
        self.assertEqual(client.id, self.client_omni.id)
        # Total spent should be updated
        self.client_omni.refresh_from_db()
        self.assertEqual(self.client_omni.total_spent, Decimal('20000.00'))

    def test_lead_convert_api_endpoint(self):
        self.client.login(username='david', password='password123')
        lead = Lead.objects.create(
            name='Elena Rostova',
            company='Nordic Glow Skincare',
            email='elena@nordicglow.co',
            estimated_deal_value=Decimal('6200.00')
        )
        response = self.client.post(f'/api/leads/{lead.id}/convert/')
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertTrue(data['success'])
        self.assertEqual(data['client']['company'], 'Nordic Glow Skincare')


# =============================================================================
# 3. Authentication & Session Tests
# =============================================================================
class AuthenticationTests(Root4TechCRMTestCase):
    def test_login_success_by_email(self):
        response = self.client.post('/api/auth/login/', json.dumps({
            'email': 'david@root4tech.com',
            'password': 'password123'
        }), content_type='application/json')
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertTrue(data['success'])
        self.assertEqual(data['user']['role_key'], 'sales_mgr')

    def test_login_invalid_password(self):
        response = self.client.post('/api/auth/login/', json.dumps({
            'email': 'david@root4tech.com',
            'password': 'wrongpassword'
        }), content_type='application/json')
        self.assertEqual(response.status_code, 401)
        self.assertFalse(response.json()['success'])

    def test_logout(self):
        self.client.login(username='david', password='password123')
        response = self.client.post('/api/auth/logout/')
        self.assertEqual(response.status_code, 200)

    def test_switch_persona_api(self):
        self.client.login(username='david', password='password123')
        response = self.client.post('/api/auth/switch-persona/', json.dumps({
            'role_key': 'dev'
        }), content_type='application/json')
        self.assertEqual(response.status_code, 403)
        self.assertFalse(response.json()['success'])


# =============================================================================
# 4. Strict Role Permission Tests Across All 4 Roles
# =============================================================================
class RolePermissionTests(Root4TechCRMTestCase):
    def test_sales_manager_has_billing_access(self):
        self.client.login(username='david', password='password123')
        response = self.client.get('/api/invoices/')
        self.assertEqual(response.status_code, 200)

    def test_salesperson_forbidden_from_invoices(self):
        self.client.login(username='sarah', password='password123')
        response = self.client.get('/api/invoices/')
        self.assertEqual(response.status_code, 403)

    def test_developer_forbidden_from_invoices(self):
        self.client.login(username='alex', password='password123')
        response = self.client.get('/api/invoices/')
        self.assertEqual(response.status_code, 403)

    def test_video_editor_forbidden_from_invoices(self):
        self.client.login(username='maya', password='password123')
        response = self.client.get('/api/invoices/')
        self.assertEqual(response.status_code, 403)

    def test_developer_sees_only_assigned_projects(self):
        self.client.login(username='alex', password='password123')
        response = self.client.get('/api/projects/')
        self.assertEqual(response.status_code, 200)
        projects = response.json().get('results', response.json())
        titles = [p['title'] for p in projects]
        self.assertIn('OmniTrade Web Terminal', titles)
        self.assertNotIn('PulseWear Commercial Cut', titles)

    def test_video_editor_sees_only_assigned_projects(self):
        self.client.login(username='maya', password='password123')
        response = self.client.get('/api/projects/')
        self.assertEqual(response.status_code, 200)
        projects = response.json().get('results', response.json())
        titles = [p['title'] for p in projects]
        self.assertIn('PulseWear Commercial Cut', titles)
        self.assertNotIn('OmniTrade Web Terminal', titles)


# =============================================================================
# 5. CRUD API Operations Tests
# =============================================================================
class CrudAPITests(Root4TechCRMTestCase):
    def setUp(self):
        super().setUp()
        self.client.login(username='david', password='password123')

    def test_create_and_retrieve_lead(self):
        response = self.client.post('/api/leads/', json.dumps({
            'name': 'Julian Hayes',
            'company': 'Quantum Logistics',
            'email': 'julian@quantumlogistics.io',
            'service_required': 'Website Development',
            'estimated_deal_value': 18000.0,
            'stage': 'Contacted'
        }), content_type='application/json')
        self.assertEqual(response.status_code, 201)
        lead_id = response.json()['id']

        get_res = self.client.get(f'/api/leads/{lead_id}/')
        self.assertEqual(get_res.status_code, 200)
        self.assertEqual(get_res.json()['company'], 'Quantum Logistics')

    def test_create_and_retrieve_client(self):
        response = self.client.post('/api/clients/', json.dumps({
            'company': 'Aurora AI Labs',
            'contact_person': 'Dr. Evelyn Reed',
            'email': 'e.reed@aurora-ai.io',
            'industry': 'Artificial Intelligence'
        }), content_type='application/json')
        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.json()['company'], 'Aurora AI Labs')

    def test_create_invoice_with_items(self):
        response = self.client.post('/api/invoices/', json.dumps({
            'client': self.client_omni.id,
            'project_scope_title': 'Website Development + Video Editing',
            'issue_date': str(date.today()),
            'due_date': str(date.today() + timedelta(days=30)),
            'amount': 8000.0,
            'items': [
                {'desc': 'Website Development', 'qty': 1, 'rate': 5500.0},
                {'desc': 'Video Editing', 'qty': 1, 'rate': 2500.0}
            ]
        }), content_type='application/json')
        self.assertEqual(response.status_code, 201)
        inv_id = response.json()['id']
        
        # Test mark paid
        mark_res = self.client.post(f'/api/invoices/{inv_id}/mark_paid/')
        self.assertEqual(mark_res.status_code, 200)

    def test_crm_bundle_hydration(self):
        response = self.client.get('/api/crm/bundle/')
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertIn('teamMembers', data)
        self.assertIn('services', data)
        self.assertIn('leads', data)
        self.assertIn('clients', data)
        self.assertIn('projects', data)
        self.assertIn('tasks', data)
        self.assertIn('invoices', data)

    # =========================================================================
    # PHASE 3 TESTS
    # =========================================================================

    def test_invoice_pdf_generator(self):
        """Test server-side PDF generation for invoices."""
        pdf_bytes = generate_invoice_pdf(self.inv_omni)
        self.assertIsInstance(pdf_bytes, bytes)
        self.assertTrue(len(pdf_bytes) > 1000)
        self.assertTrue(pdf_bytes.startswith(b'%PDF'))

    def test_quotation_pdf_generator(self):
        """Test server-side PDF generation for quotations."""
        pdf_bytes = generate_quotation_pdf(self.qtn_omni)
        self.assertIsInstance(pdf_bytes, bytes)
        self.assertTrue(len(pdf_bytes) > 1000)
        self.assertTrue(pdf_bytes.startswith(b'%PDF'))

    def test_pdf_download_endpoints(self):
        """Test GET /api/invoices/<id>/pdf/ and /api/quotations/<id>/pdf/"""
        self.client.force_login(self.user_sales_mgr)
        res_inv = self.client.get(f'/api/invoices/{self.inv_omni.id}/pdf/')
        self.assertEqual(res_inv.status_code, 200)
        self.assertEqual(res_inv['Content-Type'], 'application/pdf')
        self.assertTrue(res_inv.content.startswith(b'%PDF'))

        res_qtn = self.client.get(f'/api/quotations/{self.qtn_omni.id}/pdf/')
        self.assertEqual(res_qtn.status_code, 200)
        self.assertEqual(res_qtn['Content-Type'], 'application/pdf')
        self.assertTrue(res_qtn.content.startswith(b'%PDF'))

    def test_check_followups_command_and_deduplication(self):
        """Test Follow-up automation command, notifications, and anti-duplicate check."""
        today = timezone.now().date()
        # Create an upcoming follow-up and an overdue follow-up
        fu_upcoming = FollowUp.objects.create(
            lead=self.lead_acme,
            scheduled_date=today,
            followup_type='Call',
            assigned_to=self.user_sales,
            status='Scheduled',
            notes='Review proposal pricing'
        )
        fu_overdue = FollowUp.objects.create(
            lead=self.lead_acme,
            scheduled_date=today - timedelta(days=2),
            followup_type='Meeting',
            assigned_to=self.user_sales,
            status='Scheduled',
            notes='Initial discovery meeting'
        )

        # 1st Run: Should process both and set last_reminder_sent_at
        call_command('check_followups')
        fu_upcoming.refresh_from_db()
        fu_overdue.refresh_from_db()

        self.assertIsNotNone(fu_upcoming.last_reminder_sent_at)
        self.assertEqual(fu_upcoming.reminder_count, 1)
        self.assertEqual(fu_overdue.status, 'Overdue')
        self.assertIsNotNone(fu_overdue.last_reminder_sent_at)

        # Verify Notifications were created
        self.assertTrue(Notification.objects.filter(category='sales').exists())

        # 2nd Run immediately without --force: Deduplication prevents re-sending
        call_command('check_followups')
        fu_upcoming.refresh_from_db()
        self.assertEqual(fu_upcoming.reminder_count, 1)  # Unchanged!

    def test_create_project_from_won_deal(self):
        """Test deal confirmation auto-creating a project with proper staff assignment."""
        self.client.force_login(self.user_sales_mgr)

        lead = Lead.objects.create(
            name='Marcus Vance',
            company='Vertex Stream Corp',
            email='m.vance@vertex.io',
            service_required='Video Production & Editing',
            estimated_deal_value=Decimal('7500.00'),
            stage='Won',
            status='Won'
        )

        res = self.client.post(f'/api/leads/{lead.id}/create-project/')
        self.assertEqual(res.status_code, 200)
        proj_data = res.json()['project']
        self.assertEqual(proj_data['project_type'], 'Video Production')
        self.assertEqual(Decimal(str(proj_data['budget'])), Decimal('7500.00'))

        # Check that video editor was automatically assigned
        proj = Project.objects.get(id=proj_data['id'])
        assigned_roles = [getattr(getattr(u, 'staff_profile', None), 'role_key', None) for u in proj.assigned_staff.all()]
        self.assertIn('editor', assigned_roles)
        self.assertTrue(len(proj.milestones) > 0)

    def test_project_review_and_completion_workflow(self):
        """Test project workflow: ready-for-review, request-revision, and complete."""
        # 1. Developer marks ready for review
        self.client.force_login(self.user_dev)
        res_review = self.client.post(f'/api/projects/{self.proj_omni.id}/ready-for-review/')
        self.assertEqual(res_review.status_code, 200)
        self.proj_omni.refresh_from_db()
        self.assertEqual(self.proj_omni.status, 'Ready for Review')
        self.assertTrue(self.proj_omni.progress >= 90)

        # 2. Request revision
        self.client.force_login(self.user_sales_mgr)
        res_rev = self.client.post(f'/api/projects/{self.proj_omni.id}/request-revision/', json.dumps({
            'notes': 'Refine color grading on closing sequence'
        }), content_type='application/json')
        self.assertEqual(res_rev.status_code, 200)
        self.proj_omni.refresh_from_db()
        self.assertEqual(self.proj_omni.revisions_count, 1)
        self.assertEqual(self.proj_omni.status, 'In Review')

        # 3. Developer cannot complete project directly (forbidden)
        self.client.force_login(self.user_dev)
        res_dev_comp = self.client.post(f'/api/projects/{self.proj_omni.id}/mark-completed/')
        self.assertEqual(res_dev_comp.status_code, 403)

        # 4. Sales Manager signs off completion
        self.client.force_login(self.user_sales_mgr)
        res_comp = self.client.post(f'/api/projects/{self.proj_omni.id}/mark-completed/')
        self.assertEqual(res_comp.status_code, 200)
        self.proj_omni.refresh_from_db()
        self.assertEqual(self.proj_omni.status, 'Completed')
        self.assertEqual(self.proj_omni.progress, 100)

    def test_reports_analytics_calculation_and_filtering(self):
        """Test /api/reports/ endpoint metrics calculation and date-range filtering."""
        self.client.force_login(self.user_sales_mgr)
        res = self.client.get('/api/reports/')
        self.assertEqual(res.status_code, 200)
        data = res.json()

        self.assertIn('lead_metrics', data)
        self.assertIn('conversion_rate', data['lead_metrics'])
        self.assertIn('salesperson_performance', data)
        self.assertIn('project_metrics', data)
        self.assertIn('task_metrics', data)
        self.assertIn('team_workload', data)
        self.assertIn('financial_metrics', data)
        self.assertIn('total_invoiced', data['financial_metrics'])
        self.assertIn('total_payments_received', data['financial_metrics'])
        self.assertIn('outstanding_balance', data['financial_metrics'])

    def test_reports_csv_exports(self):
        """Test /api/reports/export-csv/ with leads, projects, and financial exports."""
        self.client.force_login(self.user_sales_mgr)
        for r_type in ['leads', 'projects', 'financial']:
            res = self.client.get(f'/api/reports/export-csv/?report_type={r_type}')
            self.assertEqual(res.status_code, 200)
            self.assertEqual(res['Content-Type'], 'text/csv')
            self.assertIn('attachment;', res['Content-Disposition'])

    def test_agency_settings_cms_and_admin_security(self):
        """Test CMS settings view and restrict write permission to administrators only."""
        # Authenticated staff can view
        self.client.force_login(self.user_sales)
        res_view = self.client.get('/api/settings/agency/')
        self.assertEqual(res_view.status_code, 200)
        self.assertIn('agency_name', res_view.json())

        # Non-admin cannot modify settings (403 Forbidden)
        res_forbidden = self.client.patch('/api/settings/agency/', json.dumps({
            'official_email': 'hacked@root4tech.com'
        }), content_type='application/json')
        self.assertEqual(res_forbidden.status_code, 403)

        # Admin user can modify settings
        admin_user = User.objects.create_superuser(username='superadmin', password='password123', email='admin@root4tech.com')
        self.client.force_login(admin_user)
        res_ok = self.client.patch('/api/settings/agency/', json.dumps({
            'official_email': 'hq@root4tech.com',
            'tax_rate': 8.5
        }), content_type='application/json')
        self.assertEqual(res_ok.status_code, 200)
        self.assertEqual(AgencySetting.get_settings().official_email, 'hq@root4tech.com')

