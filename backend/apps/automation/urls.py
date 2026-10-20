from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import AutomationRuleViewSet, AutomationLogViewSet, RunAutomationsView

router = DefaultRouter()
router.register(r'rules', AutomationRuleViewSet, basename='automation-rules')
router.register(r'logs', AutomationLogViewSet, basename='automation-logs')

urlpatterns = [
    path('run/', RunAutomationsView.as_view(), name='automation-run'),
    path('', include(router.urls)),
]
