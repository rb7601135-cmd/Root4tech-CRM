from rest_framework import viewsets, permissions, status
from rest_framework.views import APIView
from rest_framework.response import Response
from .models import AutomationRule, AutomationLog
from .serializers import AutomationRuleSerializer, AutomationLogSerializer
from .services import AutomationEngine
from apps.accounts.permissions import IsAdminOrSalesManager

class AutomationRuleViewSet(viewsets.ModelViewSet):
    serializer_class = AutomationRuleSerializer
    permission_classes = [permissions.IsAuthenticated, IsAdminOrSalesManager]
    queryset = AutomationRule.objects.all()

    def get_queryset(self):
        # Auto-seed standard rules if empty
        if not AutomationRule.objects.exists():
            default_rules = [
                (AutomationRule.RuleType.LEAD_FOLLOW_UP, 'Lead Follow-up Reminder', 0, True),
                (AutomationRule.RuleType.QUOTATION_EXPIRY, 'Quotation Expiry Reminder', 3, True),
                (AutomationRule.RuleType.INVOICE_DUE, 'Invoice Due Date Reminder', 3, True),
                (AutomationRule.RuleType.INVOICE_OVERDUE, 'Invoice Overdue Alert', 0, True),
                (AutomationRule.RuleType.PROJECT_DEADLINE, 'Project Deadline Reminder', 3, True),
                (AutomationRule.RuleType.TASK_OVERDUE, 'Task Overdue Alert', 0, True),
            ]
            for r_type, name, days, in_app in default_rules:
                AutomationRule.objects.get_or_create(
                    rule_type=r_type,
                    defaults={'name': name, 'days_trigger': days, 'send_in_app': in_app, 'is_active': True}
                )
        return AutomationRule.objects.all().order_by('rule_type')


class AutomationLogViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = AutomationLogSerializer
    permission_classes = [permissions.IsAuthenticated, IsAdminOrSalesManager]
    queryset = AutomationLog.objects.all().order_by('-executed_at')


class RunAutomationsView(APIView):
    """
    Manually or programmatically trigger the CRM automation runner.
    """
    permission_classes = [permissions.IsAuthenticated, IsAdminOrSalesManager]

    def post(self, request):
        results = AutomationEngine.run_all()
        return Response({
            'message': 'Automation cycle executed successfully.',
            'results': results
        }, status=status.HTTP_200_OK)
