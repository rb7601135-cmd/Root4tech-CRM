from rest_framework import viewsets, permissions, status, filters
from rest_framework.decorators import action
from rest_framework.response import Response
from django.db.models import Q
from django.db import IntegrityError

from .models import Client, ClientNote, ClientActivity, ClientDocument
from .serializers import (
    ClientListSerializer,
    ClientDetailSerializer,
    ClientCreateUpdateSerializer,
    ClientNoteSerializer,
    ClientDocumentSerializer,
)
from apps.accounts.permissions import CanManageClients
from apps.company.models import record_audit_log

class ClientViewSet(viewsets.ModelViewSet):
    queryset = Client.objects.all().select_related('assigned_team_member', 'created_by', 'updated_by')
    permission_classes = [CanManageClients]

    def get_serializer_class(self):
        if self.action == 'list':
            return ClientListSerializer
        elif self.action in ['create', 'update', 'partial_update']:
            return ClientCreateUpdateSerializer
        return ClientDetailSerializer

    def get_queryset(self):
        user = self.request.user
        qs = Client.objects.all().select_related('assigned_team_member', 'created_by', 'updated_by')

        # Role-based visibility
        if not user.can_view_all_records():
            if user.is_salesperson:
                # Salesperson sees clients assigned to them or created by them, or active ones
                qs = qs.filter(
                    Q(assigned_team_member=user) |
                    Q(created_by=user) |
                    Q(client_status=Client.Status.ACTIVE)
                )

        # Filters
        search = self.request.query_params.get('search')
        client_status = self.request.query_params.get('status')
        assigned = self.request.query_params.get('assigned_to')
        ordering = self.request.query_params.get('ordering', '-created_at')

        if search:
            qs = qs.filter(
                Q(client_id__icontains=search) |
                Q(name__icontains=search) |
                Q(company_name__icontains=search) |
                Q(email__icontains=search) |
                Q(phone__icontains=search)
            )

        if client_status:
            qs = qs.filter(client_status=client_status)

        if assigned:
            qs = qs.filter(assigned_team_member_id=assigned)

        allowed_orderings = ['created_at', '-created_at', 'name', '-name', 'company_name', '-company_name', 'updated_at', '-updated_at']
        if ordering in allowed_orderings:
            qs = qs.order_by(ordering)
        else:
            qs = qs.order_by('-created_at')

        return qs

    def perform_create(self, serializer):
        client = serializer.save(created_by=self.request.user, updated_by=self.request.user)
        ClientActivity.objects.create(
            client=client,
            user=self.request.user,
            action_type='CLIENT_CREATED',
            description=f"Client record created manually by {self.request.user.email}."
        )
        record_audit_log(
            user=self.request.user,
            action='CLIENT_CREATED',
            module='CLIENTS',
            entity_id=client.client_id,
            description=f"Client {client.name} ({client.client_id}) created.",
            ip_address=self.request.META.get('REMOTE_ADDR')
        )

    def perform_update(self, serializer):
        client = serializer.save(updated_by=self.request.user)
        ClientActivity.objects.create(
            client=client,
            user=self.request.user,
            action_type='CLIENT_UPDATED',
            description=f"Client details updated by {self.request.user.email}."
        )
        record_audit_log(
            user=self.request.user,
            action='CLIENT_UPDATED',
            module='CLIENTS',
            entity_id=client.client_id,
            description=f"Client {client.name} ({client.client_id}) details updated.",
            ip_address=self.request.META.get('REMOTE_ADDR')
        )

    def destroy(self, request, *args, **kwargs):
        client = self.get_object()
        # Protect deletion when related records exist
        if client.converted_from_leads.exists():
            return Response(
                {'error': 'Cannot delete client with linked leads. You may archive this client instead.'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Only administrators can permanently delete clients
        if not request.user.is_administrator:
            return Response(
                {'error': 'Only administrators can permanently delete clients.'},
                status=status.HTTP_403_FORBIDDEN
            )

        client_id_str = client.client_id
        client_name = client.name
        self.perform_destroy(client)

        record_audit_log(
            user=request.user,
            action='CLIENT_DELETED',
            module='CLIENTS',
            entity_id=client_id_str,
            description=f"Client {client_name} ({client_id_str}) permanently deleted.",
            ip_address=request.META.get('REMOTE_ADDR')
        )
        return Response(status=status.HTTP_204_NO_CONTENT)

    @action(detail=True, methods=['post'])
    def archive(self, request, pk=None):
        client = self.get_object()
        client.client_status = Client.Status.ARCHIVED
        client.updated_by = request.user
        client.save(update_fields=['client_status', 'updated_by', 'updated_at'])

        ClientActivity.objects.create(
            client=client,
            user=request.user,
            action_type='CLIENT_ARCHIVED',
            description=f"Client archived by {request.user.email}."
        )
        record_audit_log(
            user=request.user,
            action='CLIENT_ARCHIVED',
            module='CLIENTS',
            entity_id=client.client_id,
            description=f"Client {client.name} ({client.client_id}) archived.",
            ip_address=request.META.get('REMOTE_ADDR')
        )
        return Response({'message': 'Client archived successfully.', 'status': client.client_status})

    @action(detail=True, methods=['post'])
    def add_note(self, request, pk=None):
        client = self.get_object()
        content = request.data.get('content', '').strip()
        if not content:
            return Response({'content': ['Note content cannot be empty.']}, status=status.HTTP_400_BAD_REQUEST)

        note = ClientNote.objects.create(
            client=client,
            author=request.user,
            content=content
        )
        ClientActivity.objects.create(
            client=client,
            user=request.user,
            action_type='NOTE_ADDED',
            description=f"Note added by {request.user.email}."
        )
        return Response(ClientNoteSerializer(note).data, status=status.HTTP_201_CREATED)

    @action(detail=False, methods=['get'])
    def check_duplicate(self, request):
        email = request.query_params.get('email', '').strip()
        exclude_id = request.query_params.get('exclude_id')
        if not email:
            return Response({'duplicate': False})

        duplicate = Client.find_duplicate(email, exclude_id=exclude_id)
        if duplicate:
            return Response({
                'duplicate': True,
                'client': {
                    'id': duplicate.id,
                    'client_id': duplicate.client_id,
                    'name': duplicate.name,
                    'company_name': duplicate.company_name,
                    'email': duplicate.email,
                    'phone': duplicate.phone,
                    'status': duplicate.client_status,
                }
            })
        return Response({'duplicate': False})
