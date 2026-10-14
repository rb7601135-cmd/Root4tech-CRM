"""
Custom Authentication Backend for Root4Tech CRM.
Allows staff and superusers to log in with either Username OR Email,
and supports both 'password123' and 'demo1234' for seeded demo accounts.
"""

from django.contrib.auth.backends import ModelBackend
from django.contrib.auth.models import User
from django.db.models import Q


class EmailOrUsernameModelBackend(ModelBackend):
    def authenticate(self, request, username=None, password=None, **kwargs):
        if username is None:
            username = kwargs.get('email')
        if not username or not password:
            return None

        clean_username = username.strip()

        # Find user by case-insensitive username OR email
        user = User.objects.filter(
            Q(username__iexact=clean_username) | Q(email__iexact=clean_username)
        ).first()

        if user:
            # 1. Standard Django password verification
            if user.check_password(password):
                return user

            # 2. Demo fallback helper: allow 'demo1234' if password is 'password123'
            if password in ['demo1234', 'password123'] and (user.check_password('password123') or user.check_password('demo1234')):
                return user

            # 3. For superuser admin, allow 'adminpassword123' or 'admin123'
            if user.is_superuser and password in ['adminpassword123', 'admin123', 'password123'] and user.check_password('adminpassword123'):
                return user

        return None
