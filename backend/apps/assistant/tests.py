import json
from decimal import Decimal
from datetime import timedelta
from django.test import TestCase
from django.urls import reverse
from django.utils import timezone
from django.core.files.uploadedfile import SimpleUploadedFile
from rest_framework.test import APIClient
from rest_framework import status

from apps.accounts.models import User
from apps.clients.models import Client
from apps.leads.models import Lead
from apps.quotations.models import Quotation, QuotationItem
from apps.invoices.models import Invoice, InvoiceItem, Payment
from apps.projects.models import Project, Task
from apps.company.models import AuditLog, CompanySettings, ExchangeRate
from apps.assistant.models import Conversation, ChatMessage, ActionProposal, AssistantSetting
from apps.assistant.tools.crm_tools import execute_crm_tool, execute_action_proposal

class AssistantIntegrationTests(TestCase):
    def setUp(self):
        self.api = APIClient()
        self.admin = User.objects.create_user(
            email='admin@roo4tech.com',
            username='admin_test',
            password='AdminPassword123!',
            first_name='Admin',
            last_name='User',
            role=User.Role.ADMINISTRATOR
        )
        self.sales = User.objects.create_user(
            email='salesperson@roo4tech.com',
            username='sales_test',
            password='SalesPassword123!',
            first_name='Salma',
            last_name='Sales',
            role=User.Role.SALESPERSON
        )
        self.dev = User.objects.create_user(
            email='developer@roo4tech.com',
            username='dev_test',
            password='DevPassword123!',
            first_name='Dev',
            last_name='Coder',
            role=User.Role.DEVELOPER
        )

        # Exchange rate
        ExchangeRate.objects.get_or_create(currency_code='PKR', defaults={'rate_to_base': Decimal('1.0000')})

        # Base CRM Records
        self.client = Client.objects.create(
            name='Alpha Corp',
            company_name='Alpha Corporation Ltd',
            email='contact@alphacorp.com',
            phone='+92 300 9998877',
            service_interests='Software & Web Development',
            client_status=Client.Status.ACTIVE,
            created_by=self.admin
        )

        self.lead = Lead.objects.create(
            lead_name='Beta Prospect',
            company='Beta Tech',
            email='beta@betatech.io',
            phone='+92 301 5554433',
            interested_service='Mobile App Development',
            estimated_budget=Decimal('450000.00'),
            lead_source=Lead.Source.WEBSITE,
            status=Lead.Status.QUALIFIED,
            assigned_salesperson=self.sales
        )

        self.project = Project.objects.create(
            project_name='Alpha ERP Web App',
            client=self.client,
            project_manager=self.admin,
            status=Project.Status.IN_PROGRESS,
            start_date=timezone.localdate() - timedelta(days=30),
            due_date=timezone.localdate() - timedelta(days=5), # deliberately overdue for testing delayed projects
            budget=Decimal('800000.00')
        )

        self.invoice = Invoice.objects.create(
            title='Alpha Milestone 1 Invoice',
            client=self.client,
            project=self.project,
            status=Invoice.Status.OVERDUE,
            issue_date=timezone.localdate() - timedelta(days=20),
            due_date=timezone.localdate() - timedelta(days=5),
            total_amount=Decimal('250000.00'),
            amount_paid=Decimal('50000.00'),
            currency='PKR'
        )

        # Ensure assistant config is set to mock during tests
        config = AssistantSetting.get_solo()
        config.provider = 'mock'
        config.save()

    def test_conversation_crud_and_user_isolation(self):
        """Verify users can only see and access their own conversations."""
        self.api.force_authenticate(user=self.sales)

        # Create conversation as Sales
        res = self.api.post('/api/assistant/conversations/', {'title': 'Sales Chat 1'})
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        sales_conv_id = res.data['id']

        # Sales can list it
        list_res = self.api.get('/api/assistant/conversations/')
        self.assertEqual(list_res.status_code, status.HTTP_200_OK)
        self.assertEqual(len(list_res.data['results'] if 'results' in list_res.data else list_res.data), 1)

        # Switch to Developer user
        self.api.force_authenticate(user=self.dev)

        # Developer should see 0 conversations
        dev_list = self.api.get('/api/assistant/conversations/')
        dev_items = dev_list.data['results'] if 'results' in dev_list.data else dev_list.data
        self.assertEqual(len(dev_items), 0)

        # Developer trying to access sales conversation must be 404 (isolated)
        dev_access = self.api.get(f'/api/assistant/conversations/{sales_conv_id}/')
        self.assertEqual(dev_access.status_code, status.HTTP_404_NOT_FOUND)

    def test_crm_read_tools_accuracy(self):
        """Test accuracy of CRM read tools."""
        # 1. Search client
        res = execute_crm_tool(self.sales, 'crm_search_clients', {'query': 'Alpha'})
        self.assertTrue(res['verified_fact'])
        self.assertEqual(res['count'], 1)
        self.assertEqual(res['clients'][0]['client_id'], self.client.client_id)

        # 2. Get client details 360
        res_details = execute_crm_tool(self.sales, 'crm_get_client_details', {'client_id': self.client.client_id})
        self.assertTrue(res_details['found'])
        self.assertEqual(res_details['client']['name'], 'Alpha Corp')
        self.assertEqual(res_details['client']['financial_summary_pkr']['total_invoiced'], '250000.00')
        self.assertEqual(res_details['client']['financial_summary_pkr']['outstanding_balance'], '200000.00')

        # 3. Overdue invoices
        res_overdue = execute_crm_tool(self.sales, 'crm_get_overdue_invoices', {})
        self.assertTrue(res_overdue['verified_fact'])
        self.assertGreaterEqual(res_overdue['count'], 1)
        self.assertEqual(res_overdue['overdue_invoices'][0]['invoice_number'], self.invoice.invoice_number)

        # 4. Delayed projects
        res_delayed = execute_crm_tool(self.sales, 'crm_get_delayed_projects', {})
        self.assertTrue(res_delayed['verified_fact'])
        self.assertGreaterEqual(res_delayed['count'], 1)
        self.assertEqual(res_delayed['delayed_projects'][0]['project_code'], self.project.project_code)

    def test_two_phase_consequential_lead_creation(self):
        """Verify two-phase proposal & confirmed execution for lead creation."""
        # Phase 1: Propose
        proposal_res = execute_crm_tool(self.sales, 'crm_propose_create_lead', {
            'lead_name': 'New Inbound Prospect',
            'email': 'inbound@techfirm.com',
            'company': 'TechFirm Inc',
            'interested_service': 'Software & Web Development',
            'estimated_budget': 600000
        })
        self.assertTrue(proposal_res.get('requires_confirmation'))
        token = proposal_res['action_token']

        # Verify Lead is NOT in database yet
        self.assertFalse(Lead.objects.filter(email='inbound@techfirm.com').exists())

        # Phase 2: Confirm via API endpoint
        self.api.force_authenticate(user=self.sales)
        exec_res = self.api.post('/api/assistant/actions/execute/', {
            'action_token': token,
            'confirm': True
        })
        self.assertEqual(exec_res.status_code, status.HTTP_200_OK)
        self.assertTrue(exec_res.data['success'])

        # Now verify lead was created
        created_lead = Lead.objects.filter(email='inbound@techfirm.com').first()
        self.assertIsNotNone(created_lead)
        self.assertEqual(created_lead.lead_name, 'New Inbound Prospect')
        self.assertEqual(created_lead.company, 'TechFirm Inc')

        # Verify Audit Log entry was recorded
        audit = AuditLog.objects.filter(action='AI_CREATE_LEAD', entity_id=str(created_lead.id)).first()
        self.assertIsNotNone(audit)
        self.assertEqual(audit.user, self.sales)

        # Retrying the same token should fail (cannot re-execute)
        retry_res = self.api.post('/api/assistant/actions/execute/', {
            'action_token': token,
            'confirm': True
        })
        self.assertEqual(retry_res.status_code, status.HTTP_400_BAD_REQUEST)

    def test_two_phase_lead_to_client_conversion(self):
        """Verify lead to client conversion preserves centralized Client ID."""
        self.api.force_authenticate(user=self.sales)

        # Propose conversion
        proposal_res = execute_crm_tool(self.sales, 'crm_propose_convert_lead', {
            'lead_id': self.lead.id
        })
        self.assertTrue(proposal_res.get('requires_confirmation'))
        token = proposal_res['action_token']

        # Confirm execution
        exec_res = self.api.post('/api/assistant/actions/execute/', {
            'action_token': token,
            'confirm': True
        })
        self.assertEqual(exec_res.status_code, status.HTTP_200_OK)

        self.lead.refresh_from_db()
        self.assertEqual(self.lead.status, Lead.Status.WON)
        self.assertIsNotNone(self.lead.converted_client)
        self.assertTrue(self.lead.converted_client.client_id.startswith('CLI-'))
        self.assertEqual(self.lead.converted_client.name, 'Beta Prospect')

    def test_document_upload_validation(self):
        """Verify secure document parsing with size and extension validation."""
        self.api.force_authenticate(user=self.sales)

        # Valid text file
        good_file = SimpleUploadedFile("notes.txt", b"Client Alpha requested additional quotation for 5 new modules.", content_type="text/plain")
        res = self.api.post('/api/assistant/documents/upload/', {'file': good_file}, format='multipart')
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertIn("Client Alpha requested", res.data['extracted_text'])

        # Invalid executable extension
        bad_file = SimpleUploadedFile("malicious.exe", b"binarycontent", content_type="application/octet-stream")
        res_bad = self.api.post('/api/assistant/documents/upload/', {'file': bad_file}, format='multipart')
        self.assertEqual(res_bad.status_code, status.HTTP_400_BAD_REQUEST)

    def test_health_check_endpoint(self):
        """Verify /api/health/ returns clean status without secret leaks."""
        res = self.api.get('/api/health/')
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(res.json()['status'], 'healthy')
        self.assertEqual(res.json()['database'], 'healthy')
