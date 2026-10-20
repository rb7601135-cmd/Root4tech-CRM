from rest_framework import serializers
from .models import CalendarEvent
from apps.clients.serializers import ClientListSerializer
from apps.leads.serializers import LeadListSerializer
from apps.accounts.serializers import UserSerializer

class CalendarEventSerializer(serializers.ModelSerializer):
    client_details = ClientListSerializer(source='client', read_only=True)
    lead_details = LeadListSerializer(source='lead', read_only=True)
    assigned_to_details = UserSerializer(source='assigned_to', read_only=True)
    project_code = serializers.ReadOnlyField(source='project.project_code')
    project_name = serializers.ReadOnlyField(source='project.project_name')

    class Meta:
        model = CalendarEvent
        fields = [
            'id',
            'title',
            'description',
            'event_type',
            'status',
            'start_time',
            'end_time',
            'client',
            'client_details',
            'lead',
            'lead_details',
            'project',
            'project_code',
            'project_name',
            'assigned_to',
            'assigned_to_details',
            'location_or_link',
            'outcome_notes',
            'created_by',
            'created_at',
            'updated_at',
        ]
        read_only_fields = ['id', 'created_by', 'created_at', 'updated_at']
