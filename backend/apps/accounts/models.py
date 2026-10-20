from django.db import models
from django.contrib.auth.models import AbstractUser, BaseUserManager
from django.utils.translation import gettext_lazy as _
import uuid
from django.utils import timezone

class UserManager(BaseUserManager):
    def create_user(self, email, username=None, password=None, **extra_fields):
        if not email:
            raise ValueError(_('The Email must be set'))
        email = self.normalize_email(email).lower()
        if not username:
            username = email.split('@')[0]
            # Ensure unique username
            base_username = username
            counter = 1
            while self.model.objects.filter(username=username).exists():
                username = f"{base_username}{counter}"
                counter += 1

        extra_fields.setdefault('is_active', True)
        user = self.model(email=email, username=username, **extra_fields)
        user.set_password(password)
        user.save(using=self._db)
        return user

    def create_superuser(self, email, username=None, password=None, **extra_fields):
        extra_fields.setdefault('is_staff', True)
        extra_fields.setdefault('is_superuser', True)
        extra_fields.setdefault('role', User.Role.ADMINISTRATOR)

        if extra_fields.get('is_staff') is not True:
            raise ValueError(_('Superuser must have is_staff=True.'))
        if extra_fields.get('is_superuser') is not True:
            raise ValueError(_('Superuser must have is_superuser=True.'))

        return self.create_user(email, username, password, **extra_fields)


class User(AbstractUser):
    class Role(models.TextChoices):
        ADMINISTRATOR = 'Administrator', _('Administrator')
        SALES_MANAGER = 'Sales Manager', _('Sales Manager')
        SALESPERSON = 'Salesperson', _('Salesperson')
        DEVELOPER = 'Developer', _('Developer')
        VIDEO_EDITOR = 'Video Editor', _('Video Editor')

    email = models.EmailField(_('email address'), unique=True, db_index=True)
    role = models.CharField(
        max_length=30,
        choices=Role.choices,
        default=Role.SALESPERSON,
        db_index=True
    )
    phone = models.CharField(max_length=30, blank=True, default='')
    avatar = models.ImageField(upload_to='avatars/', null=True, blank=True)
    two_factor_enabled = models.BooleanField(default=False)
    two_factor_secret = models.CharField(max_length=64, blank=True, default='')
    password_reset_token = models.CharField(max_length=100, blank=True, null=True, db_index=True)
    password_reset_expires_at = models.DateTimeField(blank=True, null=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    objects = UserManager()

    USERNAME_FIELD = 'email'
    REQUIRED_FIELDS = ['username']

    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['email', 'role']),
        ]

    def __str__(self):
        full_name = self.get_full_name().strip()
        return full_name if full_name else self.email

    @property
    def full_name(self):
        name = self.get_full_name().strip()
        return name if name else self.email

    @property
    def is_administrator(self):
        return self.role == self.Role.ADMINISTRATOR or self.is_superuser

    @property
    def is_sales_manager(self):
        return self.role == self.Role.SALES_MANAGER

    @property
    def is_salesperson(self):
        return self.role == self.Role.SALESPERSON

    @property
    def is_developer(self):
        return self.role == self.Role.DEVELOPER

    @property
    def is_video_editor(self):
        return self.role == self.Role.VIDEO_EDITOR

    def can_view_all_records(self):
        """Administrators and Sales Managers can view company-wide records."""
        return self.is_administrator or self.is_sales_manager

    def can_manage_team(self):
        """Only Administrators can manage team members, roles and permissions."""
        return self.is_administrator

    def can_convert_leads(self):
        """Admins, Sales Managers, and Salespeople can convert eligible leads."""
        return self.is_administrator or self.is_sales_manager or self.is_salesperson
