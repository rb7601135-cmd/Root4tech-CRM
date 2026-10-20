from rest_framework import serializers
from .models import Lead, LeadNote, LeadActivity
from apps.accounts.serializers import UserSerializer
from apps.clients.models import Client
from apps.clients.serializers import ClientListSerializer

class LeadNoteSerializer(serializers.ModelSerializer):
    author_details = UserSerializer(source='author', read_only=True)

    class Meta:
        model = LeadNote
        fields = ['id', 'lead', 'author', 'author_details', 'content', 'created_at']
        read_only_fields = ['id', 'author', 'created_at']


class LeadActivitySerializer(serializers.ModelSerializer):
    user_details = UserSerializer(source='user', read_only=True)

    class Meta:
        model = LeadActivity
        fields = ['id', 'lead', 'user', 'user_details', 'action', 'description', 'created_at']
        read_only_fields = ['id', 'user', 'created_at']


class LeadListSerializer(serializers.ModelSerializer):
    assigned_salesperson_details = UserSerializer(source='assigned_salesperson', read_only=True)
    converted_client_details = ClientListSerializer(source='converted_client', read_only=True)

    class Meta:
        model = Lead
        fields = [
            'id',
            'lead_name',
            'company',
            'email',
            'phone',
            'website',
            'interested_service',
            'estimated_budget',
            'lead_source',
            'status',
            'priority',
            'next_follow_up_date',
            'assigned_salesperson',
            'assigned_salesperson_details',
            'converted_client',
            'converted_client_details',
            'created_at',
            'updated_at',
        ]


class LeadDetailSerializer(serializers.ModelSerializer):
    assigned_salesperson_details = UserSerializer(source='assigned_salesperson', read_only=True)
    created_by_details = UserSerializer(source='created_by', read_only=True)
    converted_by_details = UserSerializer(source='converted_by', read_only=True)
    converted_client_details = ClientListSerializer(source='converted_client', read_only=True)
    notes_list = LeadNoteSerializer(source='lead_notes', many=True, read_only=True)
    activities_list = LeadActivitySerializer(source='activities', many=True, read_only=True)

    class Meta:
        model = Lead
        fields = [
            'id',
            'lead_name',
            'company',
            'email',
            'normalized_email',
            'phone',
            'website',
            'interested_service',
            'estimated_budget',
            'lead_source',
            'status',
            'priority',
            'next_follow_up_date',
            'notes',
            'assigned_salesperson',
            'assigned_salesperson_details',
            'converted_client',
            'converted_client_details',
            'converted_at',
            'converted_by',
            'converted_by_details',
            'created_by',
            'created_by_details',
            'notes_list',
            'activities_list',
            'created_at',
            'updated_at',
        ]
        read_only_fields = [
            'id',
            'normalized_email',
            'converted_client',
            'converted_at',
            'converted_by',
            'created_at',
            'updated_at',
        ]


class LeadCreateUpdateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Lead
        fields = [
            'id',
            'lead_name',
            'company',
            'email',
            'phone',
            'website',
            'interested_service',
            'estimated_budget',
            'lead_source',
            'status',
            'priority',
            'next_follow_up_date',
            'notes',
            'assigned_salesperson',
        ]
        read_only_fields = ['id']

    def validate_email(self, value):
        if not value:
            raise serializers.ValidationError("Email address is required.")
        return value.strip().lower()


class LeadConversionSerializer(serializers.Serializer):
    billing_address = serializers.CharField(required=False, allow_blank=True, default='')
    website = serializers.CharField(required=False, allow_blank=True, default='')
    service_interests = serializers.CharField(required=False, allow_blank=True, default='')
    link_existing_client_id = serializers.CharField(required=False, allow_blank=True, default='')
    confirm_link = serializers.BooleanField(required=False, default=False)
