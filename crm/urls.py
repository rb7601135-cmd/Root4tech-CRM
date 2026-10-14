"""
URL configuration for Root4Tech CRM (App Level).
"""

from django.urls import path, include
from rest_framework.routers import DefaultRouter

from . import views

router = DefaultRouter()
router.register(r'leads', views.LeadViewSet, basename='lead')
router.register(r'clients', views.ClientViewSet, basename='client')
router.register(r'services', views.ServiceViewSet, basename='service')
router.register(r'projects', views.ProjectViewSet, basename='project')
router.register(r'tasks', views.TaskViewSet, basename='task')
router.register(r'followups', views.FollowUpViewSet, basename='followup')
router.register(r'quotations', views.QuotationViewSet, basename='quotation')
router.register(r'invoices', views.InvoiceViewSet, basename='invoice')
router.register(r'notifications', views.NotificationViewSet, basename='notification')
router.register(r'staff', views.StaffViewSet, basename='staff')

urlpatterns = [
    # REST API Endpoints
    path('api/', include(router.urls)),
    path('api/auth/login/', views.api_login, name='api_login'),
    path('api/auth/logout/', views.api_logout, name='api_logout'),
    path('api/auth/me/', views.api_current_user, name='api_current_user'),
    path('api/auth/switch-persona/', views.api_switch_persona, name='api_switch_persona'),
    path('api/crm/bundle/', views.api_crm_bundle, name='api_crm_bundle'),
    path('api/reports/', views.api_reports_analytics, name='api_reports_analytics'),
    path('api/reports/export-csv/', views.api_reports_export_csv, name='api_reports_export_csv'),
    path('api/settings/agency/', views.api_agency_settings, name='api_agency_settings'),
    path('api/invoices/<str:invoice_id>/pdf/', views.api_download_invoice_pdf, name='api_download_invoice_pdf'),
    path('api/quotations/<str:quotation_id>/pdf/', views.api_download_quotation_pdf, name='api_download_quotation_pdf'),


    # Clean HTML Page Routes
    path('', views.page_dashboard, name='dashboard'),
    path('index.html', views.page_dashboard, name='dashboard_html'),
    
    path('leads/', views.page_leads, name='leads'),
    path('leads.html', views.page_leads, name='leads_html'),
    path('lead-details/', views.page_lead_details, name='lead_details'),
    path('lead-details.html', views.page_lead_details, name='lead_details_html'),

    path('clients/', views.page_clients, name='clients'),
    path('clients.html', views.page_clients, name='clients_html'),
    path('client-details/', views.page_client_details, name='client_details'),
    path('client-details.html', views.page_client_details, name='client_details_html'),

    path('projects/', views.page_projects, name='projects'),
    path('projects.html', views.page_projects, name='projects_html'),
    path('project-details/', views.page_project_details, name='project_details'),
    path('project-details.html', views.page_project_details, name='project_details_html'),

    path('tasks/', views.page_tasks, name='tasks'),
    path('tasks.html', views.page_tasks, name='tasks_html'),

    path('calendar/', views.page_calendar, name='calendar'),
    path('calendar.html', views.page_calendar, name='calendar_html'),

    path('invoices/', views.page_invoices, name='invoices'),
    path('invoices.html', views.page_invoices, name='invoices_html'),

    path('reports/', views.page_reports, name='reports'),
    path('reports.html', views.page_reports, name='reports_html'),

    path('team/', views.page_team, name='team'),
    path('team.html', views.page_team, name='team_html'),

    path('notifications/', views.page_notifications, name='notifications'),
    path('notifications.html', views.page_notifications, name='notifications_html'),

    path('settings/', views.page_settings, name='settings'),
    path('settings.html', views.page_settings, name='settings_html'),

    path('login/', views.page_login, name='login'),
    path('login.html', views.page_login, name='login_html'),
]
