from rest_framework import serializers
from .models import CompanySettings, AuditLog, ExchangeRate, CompanyService
from apps.accounts.serializers import UserSerializer

class CompanySettingsSerializer(serializers.ModelSerializer):
    updated_by_details = UserSerializer(source='updated_by', read_only=True)
    logo_url = serializers.SerializerMethodField()

    class Meta:
        model = CompanySettings
        fields = [
            'id',
            'company_name',
            'logo',
            'logo_url',
            'email',
            'phone',
            'website',
            'address',
            'default_currency',
            'theme_preference',
            'updated_at',
            'updated_by',
            'updated_by_details',
        ]
        read_only_fields = ['id', 'updated_at', 'updated_by']

    def get_logo_url(self, obj):
        if obj.logo:
            request = self.context.get('request')
            if request:
                return request.build_absolute_uri(obj.logo.url)
            return obj.logo.url
        return None


class AuditLogSerializer(serializers.ModelSerializer):
    user_details = UserSerializer(source='user', read_only=True)

    class Meta:
        model = AuditLog
        fields = [
            'id',
            'user',
            'user_details',
            'action',
            'module',
            'entity_id',
            'description',
            'ip_address',
            'created_at',
        ]
        read_only_fields = ['id', 'created_at']


class ExchangeRateSerializer(serializers.ModelSerializer):
    updated_by_name = serializers.ReadOnlyField(source='updated_by.full_name')

    class Meta:
        model = ExchangeRate
        fields = [
            'id',
            'currency_code',
            'rate_to_base',
            'source',
            'updated_at',
            'updated_by',
            'updated_by_name'
        ]
        read_only_fields = ['id', 'updated_at', 'updated_by']


class CompanyServiceSerializer(serializers.ModelSerializer):
    class Meta:
        model = CompanyService
        fields = [
            'id',
            'name',
            'category',
            'description',
            'default_unit_price',
            'currency',
            'billing_type',
            'is_active',
            'created_at',
            'updated_at',
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']

