from django.test import TestCase
from django.urls import reverse
from rest_framework.test import APIClient
from rest_framework import status
from decimal import Decimal
from django.utils import timezone

from apps.accounts.models import User
from apps.leads.models import Lead
from apps.clients.models import Client
from apps.quotations.models import Quotation, QuotationItem
from apps.invoices.models import Invoice, InvoiceItem, Payment
from apps.projects.models import Project
from apps.calendar_events.models import CalendarEvent
from apps.automation.services import AutomationEngine
from apps.company.models import ExchangeRate

class Phase2BusinessOperationsIntegrationTest(TestCase):
    """
    Mandatory Phase 2 End-to-End Integration and Lifecycle Tests.
    """

    def setUp(self):
        self.api = APIClient()
        self.admin = User.objects.create_user(
            email='admin@roo4tech.com',
            username='admin@roo4tech.com',
            password='SecurePassword123!',
            first_name='Admin',
            last_name='User',
            role=User.Role.ADMINISTRATOR
        )
        self.sales = User.objects.create_user(
            email='sales@roo4tech.com',
            username='sales@roo4tech.com',
            password='SecurePassword123!',
            first_name='Saleem',
            last_name='Sales',
            role=User.Role.SALESPERSON
        )
        self.api.force_authenticate(user=self.admin)

        # Exchange rates setup
        ExchangeRate.objects.get_or_create(currency_code='PKR', defaults={'rate_to_base': Decimal('1.0000')})
        ExchangeRate.objects.get_or_create(currency_code='USD', defaults={'rate_to_base': Decimal('278.5000')})

    def test_complete_phase2_lifecycle_e2e(self):
        """
        Required 9-step End-to-End verification:
        1. Create a lead.
        2. Convert the lead to a client.
        3. Open a new quotation.
        4. Select that client from searchable dropdown (client_id).
        5. Save quotation.
        6. Create an invoice for the same client.
        7. Create a project for that client.
        8. Open client profile and verify all three records appear.
        9. Edit client's current profile and confirm central record updates without rewriting historical issued documents.
        """
        # Step 1: Create a lead
        lead_resp = self.api.post('/api/leads/', {
            'lead_name': 'Sarah Connor',
            'company': 'Cyberdyne Systems',
            'email': 'sarah@cyberdyne.com',
            'phone': '+1 555 0199',
            'interested_service': 'Custom ERP & AI CRM',
            'estimated_budget': '15000.00',
            'lead_source': 'Website',
            'status': 'Qualified',
            'priority': 'High'
        }, format='json')
        self.assertEqual(lead_resp.status_code, status.HTTP_201_CREATED)
        lead_id = lead_resp.data['id']

        # Step 2: Convert the lead to a client
        convert_resp = self.api.post(f'/api/leads/{lead_id}/convert/', {
            'billing_address': '450 Technology Parkway, Suite 100, Silicon Valley',
            'website': 'https://cyberdyne.com'
        }, format='json')
        self.assertEqual(convert_resp.status_code, status.HTTP_201_CREATED)
        client_data = convert_resp.data['client']
        client_pk = client_data['id']
        persistent_client_id = client_data['client_id']
        self.assertTrue(persistent_client_id.startswith('CLI-'))

        # Verify Lead is marked converted
        lead = Lead.objects.get(id=lead_id)
        self.assertEqual(lead.status, Lead.Status.WON)
        self.assertEqual(lead.converted_client.id, client_pk)

        # Step 3 & 4 & 5: Create a new Quotation selecting the persistent client ID
        quote_resp = self.api.post('/api/quotations/', {
            'title': 'AI CRM & Business Automation Platform',
            'client': client_pk,
            'related_lead': lead_id,
            'salesperson': self.sales.id,
            'currency': 'USD',
            'discount_percentage': '5.00',
            'tax_percentage': '10.00',
            'items': [
                {
                    'item_order': 1,
                    'description': 'Frontend Architecture in Next.js & TypeScript',
                    'quantity': '1.00',
                    'unit_price': '6000.00'
                },
                {
                    'item_order': 2,
                    'description': 'Backend REST Services in Django & PostgreSQL',
                    'quantity': '1.00',
                    'unit_price': '8000.00'
                }
            ]
        }, format='json')
        self.assertEqual(quote_resp.status_code, status.HTTP_201_CREATED)
        quotation_id = quote_resp.data['id']
        quotation_num = quote_resp.data['quotation_number']
        self.assertTrue(quotation_num.startswith('QTN-'))
        # 14000 subtotal, -5% (700) = 13300, +10% tax (1330) = 14630.00 total
        self.assertEqual(Decimal(quote_resp.data['subtotal']), Decimal('14000.00'))
        self.assertEqual(Decimal(quote_resp.data['total_amount']), Decimal('14630.00'))

        # Issue the quotation to seal the snapshot
        issue_quote_resp = self.api.post(f'/api/quotations/{quotation_id}/issue/')
        self.assertEqual(issue_quote_resp.status_code, status.HTTP_200_OK)
        self.assertEqual(issue_quote_resp.data['status'], 'Sent')
        self.assertEqual(issue_quote_resp.data['client_snapshot']['name'], 'Sarah Connor')
        self.assertEqual(issue_quote_resp.data['client_snapshot']['billing_address'], '450 Technology Parkway, Suite 100, Silicon Valley')

        # Test PDF generation endpoint
        pdf_resp = self.api.get(f'/api/quotations/{quotation_id}/pdf/')
        self.assertEqual(pdf_resp.status_code, status.HTTP_200_OK)
        self.assertEqual(pdf_resp['Content-Type'], 'application/pdf')
        self.assertTrue(len(pdf_resp.content) > 500)

        # Step 6: Create an invoice for the same client (converted from quotation)
        # First mark quotation accepted
        self.api.post(f'/api/quotations/{quotation_id}/accept/')
        convert_to_inv_resp = self.api.post(f'/api/quotations/{quotation_id}/convert_to_invoice/')
        self.assertEqual(convert_to_inv_resp.status_code, status.HTTP_200_OK)
        invoice_id = convert_to_inv_resp.data['invoice_id']
        invoice_num = convert_to_inv_resp.data['invoice_number']
        self.assertTrue(invoice_num.startswith('INV-'))

        # Test duplicate prevention on conversion retry
        retry_inv_resp = self.api.post(f'/api/quotations/{quotation_id}/convert_to_invoice/')
        self.assertEqual(retry_inv_resp.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("already been converted", retry_inv_resp.data['error'])

        # Verify invoice links to central client
        invoice_obj = Invoice.objects.get(id=invoice_id)
        self.assertEqual(invoice_obj.client.id, client_pk)
        self.assertEqual(invoice_obj.total_amount, Decimal('14630.00'))
        self.assertEqual(invoice_obj.remaining_balance, Decimal('14630.00'))

        # Test invoice PDF generation
        inv_pdf_resp = self.api.get(f'/api/invoices/{invoice_id}/pdf/')
        self.assertEqual(inv_pdf_resp.status_code, status.HTTP_200_OK)
        self.assertEqual(inv_pdf_resp['Content-Type'], 'application/pdf')

        # Record a partial payment
        pay_resp = self.api.post(f'/api/invoices/{invoice_id}/record_payment/', {
            'amount': '5000.00',
            'payment_method': 'Bank Transfer',
            'transaction_reference': 'WIRE-99214',
            'notes': '50% advance partial payment'
        }, format='json')
        self.assertEqual(pay_resp.status_code, status.HTTP_200_OK)
        payment_id = pay_resp.data['payment']['id']
        receipt_num = pay_resp.data['payment']['receipt_number']
        self.assertTrue(receipt_num.startswith('REC-'))

        # Verify updated invoice status and remaining balance
        invoice_obj.refresh_from_db()
        self.assertEqual(invoice_obj.status, Invoice.Status.PARTIALLY_PAID)
        self.assertEqual(invoice_obj.amount_paid, Decimal('5000.00'))
        self.assertEqual(invoice_obj.remaining_balance, Decimal('9630.00'))

        # Test receipt PDF generation
        receipt_pdf_resp = self.api.get(f'/api/payments/{payment_id}/receipt_pdf/')
        self.assertEqual(receipt_pdf_resp.status_code, status.HTTP_200_OK)
        self.assertEqual(receipt_pdf_resp['Content-Type'], 'application/pdf')

        # Step 7: Create a project for that client (via quotation conversion)
        convert_to_prj_resp = self.api.post(f'/api/quotations/{quotation_id}/convert_to_project/')
        self.assertEqual(convert_to_prj_resp.status_code, status.HTTP_200_OK)
        project_id = convert_to_prj_resp.data['project_id']
        project_code = convert_to_prj_resp.data['project_code']
        self.assertTrue(project_code.startswith('PRJ-'))

        # Test duplicate prevention on project conversion retry
        retry_prj_resp = self.api.post(f'/api/quotations/{quotation_id}/convert_to_project/')
        self.assertEqual(retry_prj_resp.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("already been converted", retry_prj_resp.data['error'])

        # Verify project is linked to the exact central client
        project_obj = Project.objects.get(id=project_id)
        self.assertEqual(project_obj.client.id, client_pk)
        self.assertEqual(project_obj.client.client_id, persistent_client_id)

        # Create a task for this project
        task_resp = self.api.post('/api/tasks/', {
            'project': project_id,
            'title': 'Setup Next.js Redux & API client',
            'assigned_to': self.sales.id,
            'priority': 'High',
            'status': 'In Progress'
        }, format='json')
        self.assertEqual(task_resp.status_code, status.HTTP_201_CREATED)

        # Create a calendar follow-up for this client
        cal_resp = self.api.post('/api/calendar-events/', {
            'title': 'Milestone 1 Demo & Review',
            'event_type': 'Demonstration',
            'client': client_pk,
            'project': project_id,
            'start_time': (timezone.now() + timezone.timedelta(days=2)).isoformat(),
            'assigned_to': self.sales.id
        }, format='json')
        self.assertEqual(cal_resp.status_code, status.HTTP_201_CREATED)

        # Step 8: Open the central client profile and verify all records appear!
        client_profile_resp = self.api.get(f'/api/clients/{client_pk}/')
        self.assertEqual(client_profile_resp.status_code, status.HTTP_200_OK)
        linked = client_profile_resp.data['linked_records']

        # Check Quotation in client profile
        self.assertEqual(linked['quotations_count'], 1)
        self.assertEqual(linked['quotations'][0]['quotation_number'], quotation_num)

        # Check Invoice in client profile
        self.assertEqual(linked['invoices_count'], 1)
        self.assertEqual(linked['invoices'][0]['invoice_number'], invoice_num)

        # Check Payment in client profile
        self.assertEqual(linked['payments_count'], 1)
        self.assertEqual(linked['payments'][0]['receipt_number'], receipt_num)

        # Check Project in client profile
        self.assertEqual(linked['projects_count'], 1)
        self.assertEqual(linked['projects'][0]['project_code'], project_code)

        # Check Calendar event in client profile
        self.assertEqual(linked['calendar_events_count'], 1)

        # Step 9: Edit client's current profile and confirm central record updates without rewriting historical issued documents!
        new_billing_address = "999 Cyberdyne Tower, New Silicon Oasis, Level 50"
        new_phone = "+1 555 9999"
        update_client_resp = self.api.patch(f'/api/clients/{client_pk}/', {
            'name': 'Sarah Connor (CEO)',
            'billing_address': new_billing_address,
            'phone': new_phone
        }, format='json')
        self.assertEqual(update_client_resp.status_code, status.HTTP_200_OK)

        # Confirm central client record updated
        updated_client = Client.objects.get(id=client_pk)
        self.assertEqual(updated_client.name, 'Sarah Connor (CEO)')
        self.assertEqual(updated_client.billing_address, new_billing_address)
        self.assertEqual(updated_client.phone, new_phone)

        # CRITICAL CHECK (Requirement 5): Previously issued quotation and invoice snapshots MUST NOT be rewritten!
        quotation_obj = Quotation.objects.get(id=quotation_id)
        self.assertEqual(quotation_obj.client_snapshot['name'], 'Sarah Connor')
        self.assertEqual(quotation_obj.client_snapshot['billing_address'], '450 Technology Parkway, Suite 100, Silicon Valley')
        self.assertEqual(quotation_obj.client_snapshot['phone'], '+1 555 0199')

        invoice_obj = Invoice.objects.get(id=invoice_id)
        self.assertEqual(invoice_obj.client_snapshot['name'], 'Sarah Connor')
        self.assertEqual(invoice_obj.client_snapshot['billing_address'], '450 Technology Parkway, Suite 100, Silicon Valley')
        self.assertEqual(invoice_obj.client_snapshot['phone'], '+1 555 0199')

        # Test Automation Cycle runs cleanly
        auto_resp = self.api.post('/api/automation/run/')
        self.assertEqual(auto_resp.status_code, status.HTTP_200_OK)
