from django.test import TestCase
from django.urls import reverse
from rest_framework.test import APIClient
from rest_framework import status
from .models import Client, ClientNote, ClientActivity
from apps.accounts.models import User

class ClientManagementTests(TestCase):
    def setUp(self):
        self.client_api = APIClient()
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
        self.developer = User.objects.create_user(
            email='dev@roo4tech.test',
            username='dev_test',
            password='Password123!',
            role=User.Role.DEVELOPER
        )

        self.client_record = Client.objects.create(
            name='Acme Corp Lead',
            company_name='Acme Technologies',
            email='hello@acme.test',
            phone='+92 300 1112233',
            service_interests='Web Development',
            client_status=Client.Status.ACTIVE,
            assigned_team_member=self.salesperson,
            created_by=self.admin
        )

    def test_client_id_auto_generated_and_persistent(self):
        self.assertTrue(self.client_record.client_id.startswith('CLI-'))
        stored_id = self.client_record.client_id
        self.client_record.name = 'Acme Corp Updated'
        self.client_record.save()
        self.client_record.refresh_from_db()
        self.assertEqual(self.client_record.client_id, stored_id)

    def test_client_crud_authorized(self):
        self.client_api.force_authenticate(user=self.admin)
        url = reverse('clients-list')
        response = self.client_api.post(url, {
            'name': 'New Global Client',
            'company_name': 'Global Corp',
            'email': 'contact@globalcorp.test',
            'phone': '+92 321 9998877',
            'service_interests': 'Mobile Apps',
            'client_status': 'Active'
        })
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        new_client_id = response.data['client_id']
        self.assertTrue(new_client_id.startswith('CLI-'))

    def test_duplicate_email_prevention(self):
        self.client_api.force_authenticate(user=self.admin)
        url = reverse('clients-list')
        response = self.client_api.post(url, {
            'name': 'Duplicate Attempt',
            'email': 'HELLO@ACME.TEST',  # Upper-case testing normalization
        })
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('email', response.data)

    def test_client_search(self):
        self.client_api.force_authenticate(user=self.salesperson)
        url = reverse('clients-list') + '?search=Acme'
        response = self.client_api.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        results = response.data.get('results', response.data)
        self.assertEqual(len(results), 1)
        self.assertEqual(results[0]['email'], 'hello@acme.test')

    def test_add_client_note(self):
        self.client_api.force_authenticate(user=self.salesperson)
        url = reverse('clients-add-note', kwargs={'pk': self.client_record.id})
        response = self.client_api.post(url, {'content': 'Discussed SLA requirements.'})
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(self.client_record.client_notes.count(), 1)

    def test_archive_client(self):
        self.client_api.force_authenticate(user=self.salesperson)
        url = reverse('clients-archive', kwargs={'pk': self.client_record.id})
        response = self.client_api.post(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.client_record.refresh_from_db()
        self.assertEqual(self.client_record.client_status, Client.Status.ARCHIVED)

    def test_unauthenticated_access_denied(self):
        url = reverse('clients-list')
        response = self.client_api.get(url)
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)
