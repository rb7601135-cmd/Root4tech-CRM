from django.test import TestCase
from django.urls import reverse
from rest_framework.test import APIClient
from rest_framework import status
from .models import User

class AccountsAndAuthTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.admin = User.objects.create_user(
            email='admin@roo4tech.test',
            username='admin_test',
            password='TestPassword123!',
            role=User.Role.ADMINISTRATOR
        )
        self.salesperson = User.objects.create_user(
            email='sales@roo4tech.test',
            username='sales_test',
            password='TestPassword123!',
            role=User.Role.SALESPERSON
        )
        self.developer = User.objects.create_user(
            email='dev@roo4tech.test',
            username='dev_test',
            password='TestPassword123!',
            role=User.Role.DEVELOPER
        )

    def test_login_success(self):
        url = reverse('auth-login')
        response = self.client.post(url, {
            'email': 'admin@roo4tech.test',
            'password': 'TestPassword123!'
        })
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('access', response.data)
        self.assertIn('refresh', response.data)
        self.assertEqual(response.data['user']['role'], User.Role.ADMINISTRATOR)

    def test_login_invalid_password(self):
        url = reverse('auth-login')
        response = self.client.post(url, {
            'email': 'admin@roo4tech.test',
            'password': 'WrongPassword!'
        })
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_deactivated_account_cannot_login(self):
        self.salesperson.is_active = False
        self.salesperson.save()

        url = reverse('auth-login')
        response = self.client.post(url, {
            'email': 'sales@roo4tech.test',
            'password': 'TestPassword123!'
        })
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('deactivated', str(response.data))

    def test_team_member_creation_admin_only(self):
        # Admin can create
        self.client.force_authenticate(user=self.admin)
        url = reverse('team-list')
        response = self.client.post(url, {
            'email': 'new_member@roo4tech.test',
            'first_name': 'New',
            'last_name': 'Member',
            'role': User.Role.SALESPERSON,
            'password': 'NewPassword123!'
        })
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

        # Salesperson cannot create team members
        self.client.force_authenticate(user=self.salesperson)
        response = self.client.post(url, {
            'email': 'unauthorized@roo4tech.test',
            'role': User.Role.SALESPERSON
        })
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_toggle_team_activation(self):
        self.client.force_authenticate(user=self.admin)
        url = reverse('team-toggle-active', kwargs={'pk': self.salesperson.id})
        response = self.client.post(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.salesperson.refresh_from_db()
        self.assertFalse(self.salesperson.is_active)

    def test_password_reset_flow(self):
        # 1. Request reset
        req_url = reverse('password-reset-request')
        response = self.client.post(req_url, {'email': 'admin@roo4tech.test'})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        token = response.data.get('token')
        self.assertTrue(token)

        # 2. Confirm reset
        conf_url = reverse('password-reset-confirm')
        response = self.client.post(conf_url, {
            'token': token,
            'new_password': 'BrandNewPassword2026!'
        })
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        # 3. Verify login with new password
        login_url = reverse('auth-login')
        response = self.client.post(login_url, {
            'email': 'admin@roo4tech.test',
            'password': 'BrandNewPassword2026!'
        })
        self.assertEqual(response.status_code, status.HTTP_200_OK)
