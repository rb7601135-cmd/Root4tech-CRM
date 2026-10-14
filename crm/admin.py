"""
Django Admin Configuration for Root4Tech CRM.
"""

from django.contrib import admin
from .models import (
    StaffProfile, Service, Client, Lead, Project, Task,
    FollowUp, Quotation, Invoice, BillingItem, Payment,
    Notification, ActivityLog
)


@admin.register(StaffProfile)
class StaffProfileAdmin(admin.ModelAdmin):
    list_display = ('user', 'role_title', 'role_key', 'phone', 'status', 'created_at')
    list_filter = ('role_key', 'status')
    search_fields = ('user__username', 'user__first_name', 'user__last_name', 'user__email', 'phone')


@admin.register(Service)
class ServiceAdmin(admin.ModelAdmin):
    list_display = ('service_id', 'name', 'category', 'price', 'unit', 'is_active')
    list_filter = ('category', 'is_active')
    search_fields = ('name', 'description')


@admin.register(Client)
class ClientAdmin(admin.ModelAdmin):
    list_display = ('client_id', 'company', 'contact_person', 'email', 'phone', 'total_spent', 'status', 'created_at')
    list_filter = ('status', 'industry')
    search_fields = ('client_id', 'company', 'contact_person', 'email', 'phone')


@admin.register(Lead)
class LeadAdmin(admin.ModelAdmin):
    list_display = ('lead_id', 'name', 'company', 'email', 'estimated_deal_value', 'stage', 'status', 'assigned_salesperson', 'is_converted')
    list_filter = ('stage', 'status', 'lead_source', 'is_converted')
    search_fields = ('lead_id', 'name', 'company', 'email', 'phone')
    actions = ['convert_selected_to_clients']

    def convert_selected_to_clients(self, request, queryset):
        converted_count = 0
        for lead in queryset.filter(is_converted=False):
            lead.convert_to_client(request.user)
            converted_count += 1
        self.message_user(request, f"Successfully converted {converted_count} lead(s) to client accounts.")
    convert_selected_to_clients.short_description = "Convert selected Leads to Clients"


@admin.register(Project)
class ProjectAdmin(admin.ModelAdmin):
    list_display = ('project_id', 'title', 'client', 'project_type', 'status', 'priority', 'progress', 'deadline', 'budget')
    list_filter = ('status', 'priority', 'project_type')
    search_fields = ('project_id', 'title', 'client__company', 'notes')
    filter_horizontal = ('assigned_staff',)


@admin.register(Task)
class TaskAdmin(admin.ModelAdmin):
    list_display = ('title', 'project', 'assigned_to', 'status', 'priority', 'due_date')
    list_filter = ('status', 'priority')
    search_fields = ('title', 'project__title', 'notes')


@admin.register(FollowUp)
class FollowUpAdmin(admin.ModelAdmin):
    list_display = ('followup_type', 'lead', 'client', 'scheduled_date', 'scheduled_time', 'assigned_to', 'status')
    list_filter = ('status', 'followup_type', 'scheduled_date')
    search_fields = ('notes', 'lead__company', 'client__company')


class BillingItemInline(admin.TabularInline):
    model = BillingItem
    extra = 1


@admin.register(Quotation)
class QuotationAdmin(admin.ModelAdmin):
    list_display = ('quotation_number', 'client_display', 'project_scope_title', 'amount', 'status', 'issue_date', 'created_by')
    list_filter = ('status', 'issue_date')
    search_fields = ('quotation_number', 'client__company', 'client_name_override', 'project_scope_title')
    inlines = [BillingItemInline]


@admin.register(Invoice)
class InvoiceAdmin(admin.ModelAdmin):
    list_display = ('invoice_number', 'client_display', 'project_scope_title', 'amount', 'paid_amount', 'status', 'issue_date', 'due_date', 'created_by')
    list_filter = ('status', 'issue_date', 'due_date')
    search_fields = ('invoice_number', 'client__company', 'client_name_override', 'project_scope_title')
    inlines = [BillingItemInline]


@admin.register(Payment)
class PaymentAdmin(admin.ModelAdmin):
    list_display = ('invoice', 'amount', 'payment_date', 'payment_method', 'reference_number', 'recorded_by')
    list_filter = ('payment_method', 'payment_date')
    search_fields = ('invoice__invoice_number', 'reference_number', 'notes')


@admin.register(Notification)
class NotificationAdmin(admin.ModelAdmin):
    list_display = ('title', 'role_target', 'recipient', 'category', 'is_read', 'created_at')
    list_filter = ('category', 'role_target', 'is_read')
    search_fields = ('title', 'message')


@admin.register(ActivityLog)
class ActivityLogAdmin(admin.ModelAdmin):
    list_display = ('timestamp', 'user', 'action', 'entity_type', 'entity_id')
    list_filter = ('action', 'entity_type')
    search_fields = ('action', 'entity_type', 'entity_id', 'details')
