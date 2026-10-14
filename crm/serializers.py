"""
REST API Serializers for Root4Tech CRM (Phase 2 Backend).
"""

from rest_framework import serializers
from django.contrib.auth.models import User
from .models import (
    StaffProfile, Service, Client, Lead, Project, Task,
    FollowUp, Quotation, Invoice, BillingItem, Payment,
    Notification, ActivityLog, AgencySetting
)


class UserBriefSerializer(serializers.ModelSerializer):
    role_key = serializers.CharField(source='staff_profile.role_key', read_only=True)
    role_title = serializers.CharField(source='staff_profile.role_title', read_only=True)
    avatar = serializers.CharField(source='staff_profile.avatar', read_only=True)
    color = serializers.CharField(source='staff_profile.color', read_only=True)

    class Meta:
        model = User
        fields = ['id', 'username', 'first_name', 'last_name', 'email', 'role_key', 'role_title', 'avatar', 'color']


class StaffProfileSerializer(serializers.ModelSerializer):
    user_id = serializers.IntegerField(source='user.id', read_only=True)
    username = serializers.CharField(source='user.username', read_only=True)
    name = serializers.SerializerMethodField()
    email = serializers.EmailField(source='user.email')
    active_projects_count = serializers.IntegerField(read_only=True)
    pending_tasks_count = serializers.IntegerField(read_only=True)

    class Meta:
        model = StaffProfile
        fields = [
            'id', 'user_id', 'username', 'name', 'email', 'role_key',
            'role_title', 'phone', 'avatar', 'color', 'skills', 'status',
            'active_projects_count', 'pending_tasks_count', 'created_at'
        ]

    def get_name(self, obj):
        return obj.user.get_full_name() or obj.user.username

    def update(self, instance, validated_data):
        user_data = validated_data.pop('user', {})
        new_email = user_data.get('email')
        if new_email and new_email != instance.user.email:
            instance.user.email = new_email
            instance.user.save(update_fields=['email'])

        name = self.initial_data.get('name')
        if name:
            parts = name.strip().split(' ', 1)
            instance.user.first_name = parts[0]
            instance.user.last_name = parts[1] if len(parts) > 1 else ''
            instance.user.save(update_fields=['first_name', 'last_name'])

        password = self.initial_data.get('password')
        if password:
            instance.user.set_password(password)
            instance.user.save(update_fields=['password'])

        return super().update(instance, validated_data)

    def create(self, validated_data):
        user_data = validated_data.pop('user', {})
        email = user_data.get('email', '')
        name = self.initial_data.get('name', 'Staff Member')
        parts = name.strip().split(' ', 1)
        first_name = parts[0]
        last_name = parts[1] if len(parts) > 1 else ''
        username = self.initial_data.get('username') or (email.split('@')[0] if email else f"staff_{timezone.now().strftime('%M%S')}")
        password = self.initial_data.get('password', 'Root4Tech2026!')

        # Ensure unique username
        base_username = username
        counter = 1
        while User.objects.filter(username=username).exists():
            username = f"{base_username}_{counter}"
            counter += 1

        user = User.objects.create_user(
            username=username,
            email=email,
            password=password,
            first_name=first_name,
            last_name=last_name,
            is_staff=True
        )

        role_key = validated_data.get('role_key', 'custom')
        group_map = {
            'sales_mgr': 'Sales Manager',
            'sales': 'Salesperson',
            'dev': 'Full-Stack Developer',
            'editor': 'Video Editor',
            'admin': 'System Administrator',
        }
        if role_key in group_map:
            group, _ = Group.objects.get_or_create(name=group_map[role_key])
            user.groups.add(group)

        profile = StaffProfile.objects.create(user=user, **validated_data)
        return profile


class ServiceSerializer(serializers.ModelSerializer):
    class Meta:
        model = Service
        fields = '__all__'


class LeadSerializer(serializers.ModelSerializer):
    assigned_salesperson_name = serializers.SerializerMethodField()
    assigned_salesperson_details = UserBriefSerializer(source='assigned_salesperson', read_only=True)

    class Meta:
        model = Lead
        fields = '__all__'

    def get_assigned_salesperson_name(self, obj):
        if obj.assigned_salesperson:
            return obj.assigned_salesperson.get_full_name() or obj.assigned_salesperson.username
        return 'Unassigned'


class ClientSerializer(serializers.ModelSerializer):
    projects_count = serializers.IntegerField(read_only=True)
    account_manager_name = serializers.SerializerMethodField()

    class Meta:
        model = Client
        fields = '__all__'

    def get_account_manager_name(self, obj):
        if obj.account_manager:
            return obj.account_manager.get_full_name() or obj.account_manager.username
        return 'Unassigned'


class TaskSerializer(serializers.ModelSerializer):
    assigned_to_name = serializers.SerializerMethodField()
    project_title = serializers.CharField(source='project.title', read_only=True)

    class Meta:
        model = Task
        fields = '__all__'

    def get_assigned_to_name(self, obj):
        if obj.assigned_to:
            return obj.assigned_to.get_full_name() or obj.assigned_to.username
        return 'Unassigned'


class ProjectSerializer(serializers.ModelSerializer):
    client_name = serializers.CharField(source='client.company', read_only=True)
    service_name = serializers.CharField(source='service.name', read_only=True)
    assigned_staff_details = UserBriefSerializer(source='assigned_staff', many=True, read_only=True)
    tasks = TaskSerializer(many=True, read_only=True)

    class Meta:
        model = Project
        fields = '__all__'


class FollowUpSerializer(serializers.ModelSerializer):
    assigned_to_name = serializers.SerializerMethodField()
    lead_company = serializers.CharField(source='lead.company', read_only=True)
    client_company = serializers.CharField(source='client.company', read_only=True)

    class Meta:
        model = FollowUp
        fields = '__all__'

    def get_assigned_to_name(self, obj):
        if obj.assigned_to:
            return obj.assigned_to.get_full_name() or obj.assigned_to.username
        return 'Unassigned'


class BillingItemSerializer(serializers.ModelSerializer):
    class Meta:
        model = BillingItem
        fields = '__all__'


class QuotationSerializer(serializers.ModelSerializer):
    client_display = serializers.CharField(read_only=True)
    created_by_name = serializers.SerializerMethodField()
    items = BillingItemSerializer(many=True, read_only=True)

    class Meta:
        model = Quotation
        fields = '__all__'

    def get_created_by_name(self, obj):
        if obj.created_by:
            return obj.created_by.get_full_name() or obj.created_by.username
        return 'Agency Admin'


class PaymentSerializer(serializers.ModelSerializer):
    recorded_by_name = serializers.SerializerMethodField()

    class Meta:
        model = Payment
        fields = '__all__'

    def get_recorded_by_name(self, obj):
        if obj.recorded_by:
            return obj.recorded_by.get_full_name() or obj.recorded_by.username
        return 'System'


class InvoiceSerializer(serializers.ModelSerializer):
    client_display = serializers.CharField(read_only=True)
    created_by_name = serializers.SerializerMethodField()
    project_title = serializers.CharField(source='project.title', read_only=True)
    balance_due = serializers.DecimalField(max_digits=12, decimal_places=2, read_only=True)
    items = BillingItemSerializer(many=True, read_only=True)
    payments = PaymentSerializer(many=True, read_only=True)

    class Meta:
        model = Invoice
        fields = '__all__'

    def get_created_by_name(self, obj):
        if obj.created_by:
            return obj.created_by.get_full_name() or obj.created_by.username
        return 'Agency Admin'


class NotificationSerializer(serializers.ModelSerializer):
    class Meta:
        model = Notification
        fields = '__all__'


class ActivityLogSerializer(serializers.ModelSerializer):
    user_name = serializers.SerializerMethodField()

    class Meta:
        model = ActivityLog
        fields = '__all__'

    def get_user_name(self, obj):
        if obj.user:
            return obj.user.get_full_name() or obj.user.username
        return 'System'


class AgencySettingSerializer(serializers.ModelSerializer):
    class Meta:
        model = AgencySetting
        fields = '__all__'

