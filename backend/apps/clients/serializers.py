from rest_framework import serializers
from .models import Client, ClientNote, ClientActivity, ClientDocument
from apps.accounts.serializers import UserSerializer

class ClientNoteSerializer(serializers.ModelSerializer):
    author_details = UserSerializer(source='author', read_only=True)

    class Meta:
        model = ClientNote
        fields = ['id', 'client', 'author', 'author_details', 'content', 'created_at']
        read_only_fields = ['id', 'author', 'created_at']


class ClientActivitySerializer(serializers.ModelSerializer):
    user_details = UserSerializer(source='user', read_only=True)

    class Meta:
        model = ClientActivity
        fields = ['id', 'client', 'user', 'user_details', 'action_type', 'description', 'created_at']
        read_only_fields = ['id', 'user', 'created_at']


class ClientDocumentSerializer(serializers.ModelSerializer):
    uploaded_by_details = UserSerializer(source='uploaded_by', read_only=True)
    file_url = serializers.SerializerMethodField()

    class Meta:
        model = ClientDocument
        fields = ['id', 'client', 'uploaded_by', 'uploaded_by_details', 'title', 'file', 'file_url', 'file_size', 'created_at']
        read_only_fields = ['id', 'uploaded_by', 'file_size', 'created_at']

    def get_file_url(self, obj):
        if obj.file:
            request = self.context.get('request')
            if request:
                return request.build_absolute_uri(obj.file.url)
            return obj.file.url
        return None


class ClientListSerializer(serializers.ModelSerializer):
    assigned_team_member_details = UserSerializer(source='assigned_team_member', read_only=True)

    class Meta:
        model = Client
        fields = [
            'id',
            'client_id',
            'name',
            'company_name',
            'email',
            'phone',
            'website',
            'client_status',
            'service_interests',
            'assigned_team_member',
            'assigned_team_member_details',
            'created_at',
            'updated_at',
        ]


class ConvertedLeadBriefSerializer(serializers.Serializer):
    id = serializers.IntegerField()
    lead_name = serializers.CharField()
    company = serializers.CharField()
    email = serializers.CharField()
    status = serializers.CharField()
    lead_source = serializers.CharField()
    estimated_budget = serializers.DecimalField(max_digits=14, decimal_places=2)
    created_at = serializers.DateTimeField()
    converted_at = serializers.DateTimeField()


class ClientDetailSerializer(serializers.ModelSerializer):
    assigned_team_member_details = UserSerializer(source='assigned_team_member', read_only=True)
    created_by_details = UserSerializer(source='created_by', read_only=True)
    updated_by_details = UserSerializer(source='updated_by', read_only=True)
    notes_list = ClientNoteSerializer(source='client_notes', many=True, read_only=True)
    activities_list = ClientActivitySerializer(source='activities', many=True, read_only=True)
    documents_list = ClientDocumentSerializer(source='documents', many=True, read_only=True)
    converted_leads = serializers.SerializerMethodField()
    linked_records = serializers.SerializerMethodField()

    class Meta:
        model = Client
        fields = [
            'id',
            'client_id',
            'name',
            'company_name',
            'email',
            'normalized_email',
            'phone',
            'website',
            'billing_address',
            'service_interests',
            'client_status',
            'notes',
            'assigned_team_member',
            'assigned_team_member_details',
            'created_by',
            'created_by_details',
            'updated_by',
            'updated_by_details',
            'notes_list',
            'activities_list',
            'documents_list',
            'converted_leads',
            'linked_records',
            'created_at',
            'updated_at',
        ]
        read_only_fields = ['id', 'client_id', 'normalized_email', 'created_at', 'updated_at']

    def get_converted_leads(self, obj):
        leads = obj.converted_from_leads.all()
        return ConvertedLeadBriefSerializer(leads, many=True).data

    def get_linked_records(self, obj):
        quotes = [
            {
                'id': q.id,
                'quotation_number': q.quotation_number,
                'title': q.title,
                'status': q.status,
                'total_amount': str(q.total_amount),
                'currency': q.currency,
                'issue_date': str(q.issue_date),
                'is_converted_to_project': q.is_converted_to_project,
                'is_converted_to_invoice': q.is_converted_to_invoice,
            }
            for q in obj.quotations.all()[:10]
        ]
        invs = [
            {
                'id': inv.id,
                'invoice_number': inv.invoice_number,
                'title': inv.title,
                'status': inv.status,
                'total_amount': str(inv.total_amount),
                'amount_paid': str(inv.amount_paid),
                'remaining_balance': str(inv.remaining_balance),
                'currency': inv.currency,
                'issue_date': str(inv.issue_date),
                'due_date': str(inv.due_date) if inv.due_date else None,
            }
            for inv in obj.invoices.all()[:10]
        ]
        pmts = [
            {
                'id': p.id,
                'receipt_number': p.receipt_number,
                'amount': str(p.amount),
                'currency': p.currency,
                'payment_date': str(p.payment_date),
                'payment_method': p.payment_method,
                'invoice_number': p.invoice.invoice_number if p.invoice else None,
            }
            for p in obj.payments.all()[:10]
        ]
        prjs = [
            {
                'id': prj.id,
                'project_code': prj.project_code,
                'project_name': prj.project_name,
                'status': prj.status,
                'progress_percentage': prj.progress_percentage,
                'budget': str(prj.budget),
                'currency': prj.currency,
                'due_date': str(prj.due_date) if prj.due_date else None,
            }
            for prj in obj.projects.all()[:10]
        ]
        events = [
            {
                'id': ev.id,
                'title': ev.title,
                'event_type': ev.event_type,
                'status': ev.status,
                'start_time': ev.start_time.isoformat(),
                'location_or_link': ev.location_or_link,
            }
            for ev in obj.calendar_events.all()[:10]
        ]
        return {
            'quotations': quotes,
            'quotations_count': obj.quotations.count(),
            'invoices': invs,
            'invoices_count': obj.invoices.count(),
            'payments': pmts,
            'payments_count': obj.payments.count(),
            'projects': prjs,
            'projects_count': obj.projects.count(),
            'calendar_events': events,
            'calendar_events_count': obj.calendar_events.count(),
        }


class ClientCreateUpdateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Client
        fields = [
            'id',
            'client_id',
            'name',
            'company_name',
            'email',
            'phone',
            'website',
            'billing_address',
            'service_interests',
            'client_status',
            'notes',
            'assigned_team_member',
        ]
        read_only_fields = ['id', 'client_id']

    def validate_email(self, value):
        norm = value.strip().lower()
        client_id = self.instance.id if self.instance else None
        duplicate = Client.find_duplicate(norm, exclude_id=client_id)
        if duplicate:
            raise serializers.ValidationError(f"A client with email '{value}' already exists ({duplicate.client_id} - {duplicate.name}).")
        return value
