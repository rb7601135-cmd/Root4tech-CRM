from rest_framework import viewsets, permissions, status, filters
from rest_framework.decorators import action
from rest_framework.response import Response
from django.utils import timezone
from .models import Project, ProjectMilestone, Task, TaskChecklistItem, TaskComment, ProjectActivity
from .serializers import (
    ProjectListSerializer,
    ProjectDetailSerializer,
    ProjectMilestoneSerializer,
    TaskSerializer,
    TaskCommentSerializer
)
from apps.company.models import record_audit_log
from apps.clients.models import ClientActivity

class ProjectViewSet(viewsets.ModelViewSet):
    """
    Project management viewset.
    List, detail, milestone management and progress tracking.
    """
    permission_classes = [permissions.IsAuthenticated]
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['project_code', 'project_name', 'client__name', 'client__company_name']
    ordering_fields = ['created_at', 'start_date', 'due_date', 'progress_percentage', 'status']
    ordering = ['-created_at']

    def get_serializer_class(self):
        if self.action in ['retrieve', 'update', 'partial_update']:
            return ProjectDetailSerializer
        return ProjectListSerializer

    def get_queryset(self):
        user = self.request.user
        qs = Project.objects.all().select_related('client', 'project_manager', 'quotation').prefetch_related('tasks', 'milestones', 'assigned_team_members')

        # Developers and video editors see their assigned projects
        if not (user.is_administrator or user.is_sales_manager):
            qs = qs.filter(project_manager=user) | qs.filter(assigned_team_members=user) | qs.filter(created_by=user)

        client_param = self.request.query_params.get('client')
        client_id_param = self.request.query_params.get('client_id')
        status_param = self.request.query_params.get('status')

        if client_param:
            qs = qs.filter(client_id=client_param)
        if client_id_param:
            qs = qs.filter(client__client_id=client_id_param)
        if status_param:
            qs = qs.filter(status=status_param)

        return qs.distinct()

    def perform_create(self, serializer):
        user = self.request.user
        project = serializer.save(created_by=user)

        record_audit_log(
            user=user,
            action='PROJECT_CREATED',
            module='PROJECTS',
            entity_id=project.project_code,
            description=f"Project {project.project_code} ({project.project_name}) created for client {project.client.name}",
            ip_address=self.request.META.get('REMOTE_ADDR')
        )
        ClientActivity.objects.create(
            client=project.client,
            user=user,
            action_type='PROJECT_CREATED',
            description=f"Project {project.project_code} initiated ({project.project_name})"
        )
        ProjectActivity.objects.create(
            project=project,
            user=user,
            action_type='PROJECT_CREATED',
            description=f"Project initiated by {user.full_name}"
        )

    def perform_update(self, serializer):
        user = self.request.user
        project = serializer.save()

        record_audit_log(
            user=user,
            action='PROJECT_UPDATED',
            module='PROJECTS',
            entity_id=project.project_code,
            description=f"Project {project.project_code} updated. Status: {project.status}, Progress: {project.progress_percentage}%",
            ip_address=self.request.META.get('REMOTE_ADDR')
        )
        ProjectActivity.objects.create(
            project=project,
            user=user,
            action_type='PROJECT_UPDATED',
            description=f"Project details updated by {user.full_name}"
        )

    @action(detail=True, methods=['post'], url_path='add_milestone')
    def add_milestone(self, request, pk=None):
        project = self.get_object()
        serializer = ProjectMilestoneSerializer(data={**request.data, 'project': project.id})
        if serializer.is_valid():
            milestone = serializer.save()
            ProjectActivity.objects.create(
                project=project,
                user=request.user,
                action_type='MILESTONE_ADDED',
                description=f"Milestone '{milestone.title}' added"
            )
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class TaskViewSet(viewsets.ModelViewSet):
    """
    Task management viewset.
    """
    serializer_class = TaskSerializer
    permission_classes = [permissions.IsAuthenticated]
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['title', 'description', 'project__project_code', 'project__project_name']
    ordering_fields = ['deadline', 'priority', 'status', 'created_at']
    ordering = ['-priority', 'deadline']

    def get_queryset(self):
        user = self.request.user
        qs = Task.objects.all().select_related('project', 'project__client', 'assigned_to', 'milestone').prefetch_related('checklists', 'comments')

        if not (user.is_administrator or user.is_sales_manager):
            qs = qs.filter(assigned_to=user) | qs.filter(project__project_manager=user) | qs.filter(project__assigned_team_members=user)

        project_param = self.request.query_params.get('project')
        client_param = self.request.query_params.get('client')
        assigned_to_param = self.request.query_params.get('assigned_to')
        status_param = self.request.query_params.get('status')
        priority_param = self.request.query_params.get('priority')

        if project_param:
            qs = qs.filter(project_id=project_param)
        if client_param:
            qs = qs.filter(project__client_id=client_param)
        if assigned_to_param:
            qs = qs.filter(assigned_to_id=assigned_to_param)
        if status_param:
            qs = qs.filter(status=status_param)
        if priority_param:
            qs = qs.filter(priority=priority_param)

        return qs.distinct()

    def perform_create(self, serializer):
        user = self.request.user
        task = serializer.save(created_by=user)
        ProjectActivity.objects.create(
            project=task.project,
            user=user,
            action_type='TASK_CREATED',
            description=f"Task '{task.title}' created (Assigned: {task.assigned_to.full_name if task.assigned_to else 'Unassigned'})"
        )

    def perform_update(self, serializer):
        user = self.request.user
        task = serializer.save()
        ProjectActivity.objects.create(
            project=task.project,
            user=user,
            action_type='TASK_UPDATED',
            description=f"Task '{task.title}' updated to {task.status}"
        )

    @action(detail=True, methods=['post'], url_path='add_comment')
    def add_comment(self, request, pk=None):
        task = self.get_object()
        content = request.data.get('content')
        if not content:
            return Response({'error': 'Comment content is required.'}, status=status.HTTP_400_BAD_REQUEST)

        comment = TaskComment.objects.create(
            task=task,
            author=request.user,
            content=content
        )
        return Response(TaskCommentSerializer(comment).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['post'], url_path='toggle_checklist')
    def toggle_checklist(self, request, pk=None):
        item_id = request.data.get('item_id')
        checklist_item = TaskChecklistItem.objects.filter(task_id=pk, id=item_id).first()
        if not checklist_item:
            return Response({'error': 'Checklist item not found.'}, status=status.HTTP_404_NOT_FOUND)

        checklist_item.is_completed = not checklist_item.is_completed
        checklist_item.save()
        return Response({'id': checklist_item.id, 'is_completed': checklist_item.is_completed})
