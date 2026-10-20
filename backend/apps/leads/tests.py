from django.test import TestCase
from django.urls import reverse
from rest_framework.test import APIClient
from rest_framework import status
from django.db import transaction
from unittest.mock import patch

from .models import Lead, LeadNote, LeadActivity
from apps.clients.models import Client, ClientNote
from apps.accounts.models import User

class LeadManagementAndConversionTests(TestCase):
    def setUp(self):
        self.api = APIClient()
        self.admin = User.objects.create_user(
            email='admin@roo4tech.test',
            username='admin_test',
            password='Password123!',
            role=User.Role.ADMINISTRATOR
        )
        self.salesperson = User.objects.create_user(
            email='sales@roo4tech.test',
            username='sales_test',
            password='Password123!',
            role=User.Role.SALESPERSON
        )
        self.other_sales = User.objects.create_user(
            email='other_sales@roo4tech.test',
            username='other_sales_test',
            password='Password123!',
            role=User.Role.SALESPERSON
        )
        self.developer = User.objects.create_user(
            email='dev@roo4tech.test',
            username='dev_test',
            password='Password123!',
            role=User.Role.DEVELOPER
        )

        self.lead = Lead.objects.create(
            lead_name='Tariq Mehmood',
            company='Mehmood Logistics',
            email='tariq@mehmoodlogistics.test',
            phone='+92 300 7766554',
            website='https://mehmoodlogistics.test',
            interested_service='Cloud ERP System',
            estimated_budget=950000.00,
            status=Lead.Status.QUALIFIED,
            priority=Lead.Priority.HIGH,
            assigned_salesperson=self.salesperson,
            notes='Initial discovery call went very well. High intent buyer.',
            created_by=self.salesperson
        )
        LeadNote.objects.create(
            lead=self.lead,
            author=self.salesperson,
            content='Follow-up agreed for proposal submission.'
        )

    def test_lead_crud_success(self):
        self.api.force_authenticate(user=self.salesperson)
        url = reverse('leads-list')
        response = self.api.post(url, {
            'lead_name': 'Aiman Khan',
            'company': 'Khan Tech',
            'email': 'aiman@khantech.test',
            'status': Lead.Status.NEW,
            'priority': Lead.Priority.MEDIUM,
            'estimated_budget': '400000.00'
        })
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(Lead.objects.filter(email='aiman@khantech.test').count(), 1)

    def test_lead_conversion_creates_one_client(self):
        """
        Verify: Converting one lead creates exactly one client, links the lead,
        marks status as Won, and preserves notes.
        """
        self.api.force_authenticate(user=self.salesperson)
        url = reverse('leads-convert', kwargs={'pk': self.lead.id})
        response = self.api.post(url, {
            'billing_address': 'Plot 44, Commercial Phase 5, DHA, Lahore',
            'service_interests': 'Cloud ERP System, Custom Web App'
        })
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        client_data = response.data['client']
        self.assertTrue(client_data['client_id'].startswith('CLI-'))

        self.lead.refresh_from_db()
        self.assertEqual(self.lead.status, Lead.Status.WON)
        self.assertIsNotNone(self.lead.converted_client)
        self.assertEqual(self.lead.converted_client.client_id, client_data['client_id'])
        self.assertEqual(self.lead.converted_client.normalized_email, 'tariq@mehmoodlogistics.test')

        # Verify exactly one client exists for this email
        self.assertEqual(Client.objects.filter(normalized_email='tariq@mehmoodlogistics.test').count(), 1)

        # Verify notes preservation
        client_notes = ClientNote.objects.filter(client=self.lead.converted_client)
        self.assertTrue(client_notes.exists())
        self.assertIn('Follow-up agreed for proposal submission', client_notes.first().content)

    def test_repeated_conversion_is_idempotent(self):
        """
        Verify: Repeating conversion never creates duplicate clients,
        returns existing linked client instead.
        """
        self.api.force_authenticate(user=self.salesperson)
        url = reverse('leads-convert', kwargs={'pk': self.lead.id})

        # 1st conversion
        resp1 = self.api.post(url, {})
        self.assertEqual(resp1.status_code, status.HTTP_201_CREATED)
        first_client_id = resp1.data['client']['client_id']

        initial_client_count = Client.objects.count()

        # 2nd conversion call (retry or double click)
        resp2 = self.api.post(url, {})
        self.assertEqual(resp2.status_code, status.HTTP_200_OK)
        self.assertTrue(resp2.data.get('already_converted'))
        self.assertEqual(resp2.data['client']['client_id'], first_client_id)

        # Confirm no extra client was created
        self.assertEqual(Client.objects.count(), initial_client_count)

    def test_duplicate_client_detection_triggers_conflict(self):
        """
        If a client with the same email already exists, conversion without confirmation
        returns HTTP 409 Conflict with the existing client details.
        """
        existing_client = Client.objects.create(
            name='Existing Company Contact',
            company_name='Existing Corp',
            email='tariq@mehmoodlogistics.test',  # Same email as lead
            created_by=self.admin
        )

        self.api.force_authenticate(user=self.salesperson)
        url = reverse('leads-convert', kwargs={'pk': self.lead.id})
        response = self.api.post(url, {})
        self.assertEqual(response.status_code, status.HTTP_409_CONFLICT)
        self.assertTrue(response.data.get('conflict'))
        self.assertEqual(response.data['duplicate_client']['client_id'], existing_client.client_id)

        # Link lead to existing client with confirmation
        link_response = self.api.post(url, {
            'link_existing_client_id': existing_client.client_id,
            'confirm_link': True
        })
        self.assertEqual(link_response.status_code, status.HTTP_200_OK)
        self.lead.refresh_from_db()
        self.assertEqual(self.lead.converted_client, existing_client)
        self.assertEqual(self.lead.status, Lead.Status.WON)

    def test_unauthorized_user_cannot_convert_lead(self):
        # Developer role cannot convert leads
        self.api.force_authenticate(user=self.developer)
        url = reverse('leads-convert', kwargs={'pk': self.lead.id})
        response = self.api.post(url, {})
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_lead_search_and_filter(self):
        self.api.force_authenticate(user=self.salesperson)
        url = reverse('leads-list') + '?search=Mehmood&status=Qualified'
        response = self.api.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        results = response.data.get('results', response.data)
        self.assertEqual(len(results), 1)
        self.assertEqual(results[0]['lead_name'], 'Tariq Mehmood')

    def test_conversion_transaction_rollback_on_failure(self):
        """
        Verify database transaction rollback: If client creation fails,
        lead status is not changed and no orphaned record is saved.
        """
        self.api.force_authenticate(user=self.salesperson)
        url = reverse('leads-convert', kwargs={'pk': self.lead.id})

        initial_client_count = Client.objects.count()

        with patch('apps.clients.models.Client.save', side_effect=Exception("Database connection interrupted")):
            try:
                self.api.post(url, {})
            except Exception:
                pass

        # Verify rollback
        self.lead.refresh_from_db()
        self.assertNotEqual(self.lead.status, Lead.Status.WON)
        self.assertIsNone(self.lead.converted_client)
        self.assertEqual(Client.objects.count(), initial_client_count)
