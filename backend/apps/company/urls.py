from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import CompanySettingsView, AuditLogViewSet, ExchangeRateViewSet, CompanyServiceViewSet

router = DefaultRouter()
router.register(r'audit-logs', AuditLogViewSet, basename='audit-logs')
router.register(r'exchange-rates', ExchangeRateViewSet, basename='exchange-rates')
router.register(r'services', CompanyServiceViewSet, basename='services')

urlpatterns = [
    path('settings/', CompanySettingsView.as_view(), name='company-settings'),
    path('', include(router.urls)),
]
