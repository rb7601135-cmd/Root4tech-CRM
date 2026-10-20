from django.test import TestCase
from django.urls import reverse
from rest_framework.test import APIClient
from rest_framework import status
from django.core.files.uploadedfile import SimpleUploadedFile
from .models import CompanySettings, AuditLog
from apps.accounts.models import User

class CompanySettingsAndAuditTests(TestCase):
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

    def test_company_settings_get(self):
        self.api.force_authenticate(user=self.salesperson)
        url = reverse('company-settings')
        response = self.api.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['company_name'], 'Roo4Tech')
        self.assertEqual(response.data['default_currency'], 'PKR')

    def test_company_settings_update_admin_only(self):
        url = reverse('company-settings')

        # Salesperson denied
        self.api.force_authenticate(user=self.salesperson)
        resp_sales = self.api.patch(url, {'company_name': 'Hacked Name'})
        self.assertEqual(resp_sales.status_code, status.HTTP_403_FORBIDDEN)

        # Admin allowed
        self.api.force_authenticate(user=self.admin)
        resp_admin = self.api.patch(url, {'phone': '+92 300 0000000'})
        self.assertEqual(resp_admin.status_code, status.HTTP_200_OK)
        self.assertEqual(resp_admin.data['phone'], '+92 300 0000000')

    def test_logo_upload_validation(self):
        self.api.force_authenticate(user=self.admin)
        url = reverse('company-settings')

        # 1. Test invalid file extension (e.g. .exe or .txt)
        bad_file = SimpleUploadedFile("bad_logo.txt", b"plain text content", content_type="text/plain")
        response = self.api.patch(url, {'logo': bad_file}, format='multipart')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('logo', response.data)

        # 2. Test file size exceeding 2MB
        oversized_data = b"x" * (3 * 1024 * 1024)
        oversized_file = SimpleUploadedFile("big_logo.png", oversized_data, content_type="image/png")
        response2 = self.api.patch(url, {'logo': oversized_file}, format='multipart')
        self.assertEqual(response2.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('logo', response2.data)

    def test_audit_logs_viewable_by_admin(self):
        self.api.force_authenticate(user=self.admin)
        url = reverse('audit-logs-list')
        response = self.api.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
