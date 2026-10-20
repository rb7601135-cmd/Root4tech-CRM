from rest_framework import viewsets, permissions, status, filters
from rest_framework.decorators import action
from rest_framework.response import Response
from django.db import transaction, IntegrityError
from django.db.models import Q
from django.utils import timezone

from .models import Lead, LeadNote, LeadActivity
from .serializers import (
    LeadListSerializer,
    LeadDetailSerializer,
    LeadCreateUpdateSerializer,
    LeadConversionSerializer,
    LeadNoteSerializer,
)
from apps.clients.models import Client, ClientNote, ClientActivity
from apps.clients.serializers import ClientDetailSerializer, ClientListSerializer
from apps.accounts.permissions import CanManageLeads
from apps.company.models import record_audit_log

class LeadViewSet(viewsets.ModelViewSet):
    queryset = Lead.objects.all().select_related('assigned_salesperson', 'converted_client', 'created_by')
    permission_classes = [CanManageLeads]

    def get_serializer_class(self):
        if self.action == 'list':
            return LeadListSerializer
        elif self.action in ['create', 'update', 'partial_update']:
            return LeadCreateUpdateSerializer
        return LeadDetailSerializer

    def get_queryset(self):
        user = self.request.user
        qs = Lead.objects.all().select_related('assigned_salesperson', 'converted_client', 'created_by')

        if not user.can_view_all_records():
            if user.is_salesperson:
                # Salesperson sees assigned leads or leads created by them
                qs = qs.filter(
                    Q(assigned_salesperson=user) |
                    Q(created_by=user) |
                    Q(assigned_salesperson__isnull=True)
                )

        search = self.request.query_params.get('search')
        lead_status = self.request.query_params.get('status')
        priority = self.request.query_params.get('priority')
        source = self.request.query_params.get('source')
        assigned = self.request.query_params.get('assigned_to')
        ordering = self.request.query_params.get('ordering', '-created_at')

        if search:
            qs = qs.filter(
                Q(lead_name__icontains=search) |
                Q(company__icontains=search) |
                Q(email__icontains=search) |
                Q(phone__icontains=search) |
                Q(interested_service__icontains=search)
            )

        if lead_status:
            qs = qs.filter(status=lead_status)

        if priority:
            qs = qs.filter(priority=priority)

        if source:
            qs = qs.filter(lead_source=source)

        if assigned:
            qs = qs.filter(assigned_salesperson_id=assigned)

        allowed_orderings = [
            'created_at', '-created_at',
            'lead_name', '-lead_name',
            'company', '-company',
            'next_follow_up_date', '-next_follow_up_date',
            'estimated_budget', '-estimated_budget'
        ]
        if ordering in allowed_orderings:
            qs = qs.order_by(ordering)
        else:
            qs = qs.order_by('-created_at')

        return qs

    def perform_create(self, serializer):
        lead = serializer.save(created_by=self.request.user)
        LeadActivity.objects.create(
            lead=lead,
            user=self.request.user,
            action='LEAD_CREATED',
            description=f"Lead created by {self.request.user.email} with status {lead.status}."
        )
        record_audit_log(
            user=self.request.user,
            action='LEAD_CREATED',
            module='LEADS',
            entity_id=str(lead.id),
            description=f"Lead {lead.lead_name} created.",
            ip_address=self.request.META.get('REMOTE_ADDR')
        )

    def perform_update(self, serializer):
        old_lead = self.get_object()
        old_status = old_lead.status
        old_assigned = old_lead.assigned_salesperson
        lead = serializer.save()

        notes_arr = []
        if old_status != lead.status:
            notes_arr.append(f"status from {old_status} to {lead.status}")
        if old_assigned != lead.assigned_salesperson:
            new_name = lead.assigned_salesperson.email if lead.assigned_salesperson else 'Unassigned'
            notes_arr.append(f"assigned to {new_name}")

        LeadActivity.objects.create(
            lead=lead,
            user=self.request.user,
            action='LEAD_UPDATED',
            description=f"Lead updated by {self.request.user.email}: {', '.join(notes_arr) if notes_arr else 'details modified'}."
        )
        record_audit_log(
            user=self.request.user,
            action='LEAD_UPDATED',
            module='LEADS',
            entity_id=str(lead.id),
            description=f"Lead {lead.lead_name} updated.",
            ip_address=self.request.META.get('REMOTE_ADDR')
        )

    def destroy(self, request, *args, **kwargs):
        lead = self.get_object()
        if lead.is_converted:
            return Response(
                {'error': 'Cannot delete an already converted lead. Its client link must be preserved.'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Only admin or sales manager can delete leads
        if not (request.user.is_administrator or request.user.is_sales_manager):
            return Response(
                {'error': 'Only administrators or sales managers can delete leads.'},
                status=status.HTTP_403_FORBIDDEN
            )

        lead_id = str(lead.id)
        lead_name = lead.lead_name
        self.perform_destroy(lead)

        record_audit_log(
            user=request.user,
            action='LEAD_DELETED',
            module='LEADS',
            entity_id=lead_id,
            description=f"Lead {lead_name} (ID {lead_id}) deleted.",
            ip_address=request.META.get('REMOTE_ADDR')
        )
        return Response(status=status.HTTP_204_NO_CONTENT)

    @action(detail=True, methods=['post'])
    def add_note(self, request, pk=None):
        lead = self.get_object()
        content = request.data.get('content', '').strip()
        if not content:
            return Response({'content': ['Note cannot be empty.']}, status=status.HTTP_400_BAD_REQUEST)

        note = LeadNote.objects.create(
            lead=lead,
            author=request.user,
            content=content
        )
        LeadActivity.objects.create(
            lead=lead,
            user=request.user,
            action='NOTE_ADDED',
            description=f"Note added by {request.user.email}."
        )
        return Response(LeadNoteSerializer(note).data, status=status.HTTP_201_CREATED)

    @action(detail=False, methods=['get'])
    def check_duplicate(self, request):
        email = request.query_params.get('email', '').strip()
        exclude_id = request.query_params.get('exclude_id')
        if not email:
            return Response({'duplicate_lead': False, 'duplicate_client': False})

        duplicate_lead = Lead.find_duplicate(email, exclude_id=exclude_id)
        duplicate_client = Client.find_duplicate(email)

        data = {
            'duplicate_lead': bool(duplicate_lead),
            'duplicate_client': bool(duplicate_client),
        }
        if duplicate_lead:
            data['lead'] = {
                'id': duplicate_lead.id,
                'lead_name': duplicate_lead.lead_name,
                'company': duplicate_lead.company,
                'email': duplicate_lead.email,
                'status': duplicate_lead.status,
            }
        if duplicate_client:
            data['client'] = {
                'id': duplicate_client.id,
                'client_id': duplicate_client.client_id,
                'name': duplicate_client.name,
                'company_name': duplicate_client.company_name,
                'email': duplicate_client.email,
                'status': duplicate_client.client_status,
            }
        return Response(data)

    @action(detail=True, methods=['post'])
    def convert(self, request, pk=None):
        """
        Convert Lead to Client endpoint.
        Requirements:
        1. Atomic transaction.
        2. Idempotent: If lead already converted, returns existing linked client.
        3. Duplicate detection: Checks for existing client with normalized email.
        4. If duplicate exists and not confirmed to link, returns 409 Conflict with matching client details.
        5. If confirmed or no duplicate, creates or links client, sets status Won, preserves histories.
        """
        lead = self.get_object()

        # Permission check
        if not request.user.can_convert_leads():
            return Response(
                {'error': 'You do not have permission to convert leads.'},
                status=status.HTTP_403_FORBIDDEN
            )

        # Salespeople can only convert their assigned leads or unassigned leads
        if request.user.is_salesperson and lead.assigned_salesperson and lead.assigned_salesperson != request.user:
            return Response(
                {'error': 'Salespeople can only convert leads assigned to them.'},
                status=status.HTTP_403_FORBIDDEN
            )

        # 1. Idempotency: If already converted, return existing linked client!
        if lead.is_converted:
            existing_client = lead.converted_client
            return Response({
                'message': 'Lead has already been converted to a client.',
                'already_converted': True,
                'client': ClientDetailSerializer(existing_client, context={'request': request}).data
            }, status=status.HTTP_200_OK)

        serializer = LeadConversionSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        billing_address = data.get('billing_address', '').strip()
        website = data.get('website', '').strip() or lead.website
        service_interests = data.get('service_interests', '').strip() or lead.interested_service
        link_existing_client_id = data.get('link_existing_client_id', '').strip()
        confirm_link = data.get('confirm_link', False)

        with transaction.atomic():
            # Check duplicate client by normalized email
            existing_client = Client.find_duplicate(lead.email)

            # If existing duplicate exists and caller has not confirmed linking to it
            if existing_client and not confirm_link and not link_existing_client_id:
                return Response({
                    'conflict': True,
                    'message': 'A client with this email address already exists. Would you like to link this lead to the existing client profile?',
                    'duplicate_client': ClientListSerializer(existing_client).data
                }, status=status.HTTP_409_CONFLICT)

            client_to_link = None

            if link_existing_client_id or (existing_client and confirm_link):
                # Linking to existing client
                if link_existing_client_id:
                    try:
                        if str(link_existing_client_id).isdigit():
                            c_filter = Q(id=int(link_existing_client_id)) | Q(client_id=str(link_existing_client_id))
                        else:
                            c_filter = Q(client_id=str(link_existing_client_id))
                        client_to_link = Client.objects.select_for_update().get(c_filter)
                    except Client.DoesNotExist:
                        return Response({'error': f"Target client '{link_existing_client_id}' not found."}, status=status.HTTP_404_NOT_FOUND)
                else:
                    client_to_link = Client.objects.select_for_update().get(id=existing_client.id)


                # Link lead to existing client
                lead.converted_client = client_to_link
                lead.status = Lead.Status.WON
                lead.converted_at = timezone.now()
                lead.converted_by = request.user
                lead.save(update_fields=['converted_client', 'status', 'converted_at', 'converted_by', 'updated_at'])

                # Log activity on both records
                LeadActivity.objects.create(
                    lead=lead,
                    user=request.user,
                    action='LEAD_CONVERTED_LINKED',
                    description=f"Lead converted and linked to existing client {client_to_link.client_id} ({client_to_link.name})."
                )
                ClientActivity.objects.create(
                    client=client_to_link,
                    user=request.user,
                    action_type='LEAD_LINKED',
                    description=f"Lead '{lead.lead_name}' was converted and linked to this client."
                )

                record_audit_log(
                    user=request.user,
                    action='LEAD_CONVERTED_AND_LINKED',
                    module='LEADS',
                    entity_id=str(lead.id),
                    description=f"Lead {lead.lead_name} linked to existing client {client_to_link.client_id}.",
                    ip_address=request.META.get('REMOTE_ADDR')
                )

                return Response({
                    'message': f"Lead successfully linked to existing client {client_to_link.client_id}.",
                    'client': ClientDetailSerializer(client_to_link, context={'request': request}).data
                }, status=status.HTTP_200_OK)

            # No duplicate or creating new client
            new_client = Client(
                name=lead.lead_name,
                company_name=lead.company,
                email=lead.email,
                phone=lead.phone,
                website=website,
                billing_address=billing_address,
                service_interests=service_interests,
                client_status=Client.Status.LEAD_CONVERTED,
                assigned_team_member=lead.assigned_salesperson,
                notes=f"Converted from Lead: {lead.lead_name}\nSource: {lead.lead_source}\n{lead.notes}".strip(),
                created_by=request.user,
                updated_by=request.user,
            )
            new_client.save()

            # Copy lead notes to client notes to preserve communication history
            for lead_note in lead.lead_notes.all():
                ClientNote.objects.create(
                    client=new_client,
                    author=lead_note.author,
                    content=f"[From Lead Note]: {lead_note.content}"
                )

            # Link the lead
            lead.converted_client = new_client
            lead.status = Lead.Status.WON
            lead.converted_at = timezone.now()
            lead.converted_by = request.user
            lead.save(update_fields=['converted_client', 'status', 'converted_at', 'converted_by', 'updated_at'])

            # Activities
            LeadActivity.objects.create(
                lead=lead,
                user=request.user,
                action='LEAD_CONVERTED',
                description=f"Lead converted to new client {new_client.client_id}."
            )
            ClientActivity.objects.create(
                client=new_client,
                user=request.user,
                action_type='CLIENT_CREATED_FROM_LEAD',
                description=f"Client created via conversion from lead '{lead.lead_name}' (Source: {lead.lead_source})."
            )

            record_audit_log(
                user=request.user,
                action='LEAD_CONVERTED_TO_NEW_CLIENT',
                module='LEADS',
                entity_id=str(lead.id),
                description=f"Lead {lead.lead_name} converted to new client {new_client.client_id}.",
                ip_address=request.META.get('REMOTE_ADDR')
            )

            return Response({
                'message': 'Lead successfully converted to client!',
                'client': ClientDetailSerializer(new_client, context={'request': request}).data
            }, status=status.HTTP_201_CREATED)
