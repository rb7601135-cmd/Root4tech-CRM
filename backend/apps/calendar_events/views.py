from rest_framework import viewsets, permissions, status, filters
from rest_framework.decorators import action
from rest_framework.response import Response
from django.utils import timezone
from datetime import datetime
from .models import CalendarEvent
from .serializers import CalendarEventSerializer
from apps.company.models import record_audit_log
from apps.clients.models import ClientActivity

class CalendarEventViewSet(viewsets.ModelViewSet):
    """
    Calendar and Follow-ups viewset.
    Supports daily, weekly, monthly queries and status updates.
    """
    serializer_class = CalendarEventSerializer
    permission_classes = [permissions.IsAuthenticated]
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['title', 'description', 'client__name', 'lead__lead_name', 'location_or_link']
    ordering_fields = ['start_time', 'created_at', 'status']
    ordering = ['start_time']

    def get_queryset(self):
        user = self.request.user
        qs = CalendarEvent.objects.all().select_related('client', 'lead', 'project', 'assigned_to', 'created_by')

        if not (user.is_administrator or user.is_sales_manager):
            qs = qs.filter(assigned_to=user) | qs.filter(created_by=user)

        client_param = self.request.query_params.get('client')
        client_id_param = self.request.query_params.get('client_id')
        lead_param = self.request.query_params.get('lead')
        project_param = self.request.query_params.get('project')
        event_type_param = self.request.query_params.get('event_type')
        status_param = self.request.query_params.get('status')
        start_date_param = self.request.query_params.get('start_date')
        end_date_param = self.request.query_params.get('end_date')

        if client_param:
            qs = qs.filter(client_id=client_param)
        if client_id_param:
            qs = qs.filter(client__client_id=client_id_param)
        if lead_param:
            qs = qs.filter(lead_id=lead_param)
        if project_param:
            qs = qs.filter(project_id=project_param)
        if event_type_param:
            qs = qs.filter(event_type=event_type_param)
        if status_param:
            qs = qs.filter(status=status_param)

        if start_date_param:
            try:
                start_dt = timezone.make_aware(datetime.fromisoformat(start_date_param.replace('Z', '+00:00')))
                qs = qs.filter(start_time__gte=start_dt)
            except Exception:
                pass

        if end_date_param:
            try:
                end_dt = timezone.make_aware(datetime.fromisoformat(end_date_param.replace('Z', '+00:00')))
                qs = qs.filter(start_time__lte=end_dt)
            except Exception:
                pass

        # Update overdue events dynamically
        now = timezone.now()
        for event in qs.filter(status=CalendarEvent.Status.PENDING, start_time__lt=now):
            event.status = CalendarEvent.Status.OVERDUE
            event.save(update_fields=['status'])

        return qs.distinct()

    def perform_create(self, serializer):
        user = self.request.user
        event = serializer.save(created_by=user)

        record_audit_log(
            user=user,
            action='EVENT_CREATED',
            module='CALENDAR',
            entity_id=str(event.id),
            description=f"Created {event.event_type} '{event.title}' scheduled for {event.start_time.strftime('%Y-%m-%d %H:%M')}",
            ip_address=self.request.META.get('REMOTE_ADDR')
        )

        if event.client:
            ClientActivity.objects.create(
                client=event.client,
                user=user,
                action_type='EVENT_SCHEDULED',
                description=f"Scheduled {event.event_type}: {event.title} at {event.start_time.strftime('%Y-%m-%d %H:%M')}"
            )

    @action(detail=True, methods=['post'], url_path='complete')
    def complete_event(self, request, pk=None):
        """
        Mark calendar event / follow-up as completed.
        """
        event = self.get_object()
        outcome = request.data.get('outcome_notes', '')

        event.status = CalendarEvent.Status.COMPLETED
        if outcome:
            event.outcome_notes = outcome
        event.save()

        record_audit_log(
            user=request.user,
            action='EVENT_COMPLETED',
            module='CALENDAR',
            entity_id=str(event.id),
            description=f"Completed {event.event_type} '{event.title}'. Notes: {outcome}",
            ip_address=request.META.get('REMOTE_ADDR')
        )

        if event.client:
            ClientActivity.objects.create(
                client=event.client,
                user=request.user,
                action_type='EVENT_COMPLETED',
                description=f"Completed {event.event_type}: {event.title}. {outcome}"
            )

        return Response(CalendarEventSerializer(event).data)
