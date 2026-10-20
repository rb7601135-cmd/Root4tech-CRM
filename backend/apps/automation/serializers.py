from rest_framework import serializers
from .models import AutomationRule, AutomationLog

class AutomationRuleSerializer(serializers.ModelSerializer):
    class Meta:
        model = AutomationRule
        fields = ['id', 'rule_type', 'name', 'is_active', 'days_trigger', 'send_in_app', 'send_email', 'updated_at']
        read_only_fields = ['id', 'updated_at']


class AutomationLogSerializer(serializers.ModelSerializer):
    class Meta:
        model = AutomationLog
        fields = ['id', 'rule_type', 'entity_type', 'entity_id', 'dedup_key', 'status', 'message', 'executed_at']
        read_only_fields = ['id', 'executed_at']
