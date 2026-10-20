from rest_framework import serializers
from .models import Project, ProjectMilestone, Task, TaskChecklistItem, TaskComment, ProjectActivity
from apps.clients.serializers import ClientListSerializer
from apps.accounts.serializers import UserSerializer

class TaskChecklistItemSerializer(serializers.ModelSerializer):
    class Meta:
        model = TaskChecklistItem
        fields = ['id', 'item_order', 'description', 'is_completed']


class TaskCommentSerializer(serializers.ModelSerializer):
    author_details = UserSerializer(source='author', read_only=True)

    class Meta:
        model = TaskComment
        fields = ['id', 'task', 'author', 'author_details', 'content', 'created_at']
        read_only_fields = ['id', 'author', 'created_at']


class TaskSerializer(serializers.ModelSerializer):
    assigned_to_details = UserSerializer(source='assigned_to', read_only=True)
    checklists = TaskChecklistItemSerializer(many=True, required=False)
    comments = TaskCommentSerializer(many=True, read_only=True)
    project_code = serializers.ReadOnlyField(source='project.project_code')
    project_name = serializers.ReadOnlyField(source='project.project_name')

    class Meta:
        model = Task
        fields = [
            'id',
            'project',
            'project_code',
            'project_name',
            'milestone',
            'title',
            'description',
            'assigned_to',
            'assigned_to_details',
            'priority',
            'status',
            'deadline',
            'dependencies',
            'checklists',
            'comments',
            'created_at',
            'updated_at',
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']

    def create(self, validated_data):
        checklists_data = validated_data.pop('checklists', [])
        task = Task.objects.create(**validated_data)
        for idx, item in enumerate(checklists_data):
            TaskChecklistItem.objects.create(
                task=task,
                item_order=item.get('item_order', idx + 1),
                description=item.get('description', ''),
                is_completed=item.get('is_completed', False)
            )
        return task

    def update(self, instance, validated_data):
        checklists_data = validated_data.pop('checklists', None)
        for attr, val in validated_data.items():
            setattr(instance, attr, val)
        instance.save()

        if checklists_data is not None:
            instance.checklists.all().delete()
            for idx, item in enumerate(checklists_data):
                TaskChecklistItem.objects.create(
                    task=instance,
                    item_order=item.get('item_order', idx + 1),
                    description=item.get('description', ''),
                    is_completed=item.get('is_completed', False)
                )
        return instance


class ProjectMilestoneSerializer(serializers.ModelSerializer):
    tasks_count = serializers.SerializerMethodField()

    class Meta:
        model = ProjectMilestone
        fields = [
            'id',
            'project',
            'title',
            'description',
            'due_date',
            'deliverables',
            'budget_allocated',
            'is_completed',
            'completed_at',
            'tasks_count',
            'created_at',
        ]
        read_only_fields = ['id', 'created_at']

    def get_tasks_count(self, obj):
        return obj.tasks.count()


class ProjectActivitySerializer(serializers.ModelSerializer):
    user_details = UserSerializer(source='user', read_only=True)

    class Meta:
        model = ProjectActivity
        fields = ['id', 'project', 'user', 'user_details', 'action_type', 'description', 'created_at']
        read_only_fields = ['id', 'user', 'created_at']


class ProjectListSerializer(serializers.ModelSerializer):
    client_details = ClientListSerializer(source='client', read_only=True)
    project_manager_details = UserSerializer(source='project_manager', read_only=True)
    tasks_count = serializers.SerializerMethodField()
    completed_tasks_count = serializers.SerializerMethodField()

    class Meta:
        model = Project
        fields = [
            'id',
            'project_code',
            'project_name',
            'client',
            'client_details',
            'quotation',
            'status',
            'project_manager',
            'project_manager_details',
            'start_date',
            'due_date',
            'budget',
            'currency',
            'progress_percentage',
            'tasks_count',
            'completed_tasks_count',
            'created_at',
        ]

    def get_tasks_count(self, obj):
        return obj.tasks.count()

    def get_completed_tasks_count(self, obj):
        return obj.tasks.filter(status='Done').count()


class ProjectDetailSerializer(serializers.ModelSerializer):
    client_details = ClientListSerializer(source='client', read_only=True)
    project_manager_details = UserSerializer(source='project_manager', read_only=True)
    assigned_team_members_details = UserSerializer(source='assigned_team_members', many=True, read_only=True)
    milestones = ProjectMilestoneSerializer(many=True, read_only=True)
    tasks = TaskSerializer(many=True, read_only=True)
    activities = ProjectActivitySerializer(many=True, read_only=True)

    class Meta:
        model = Project
        fields = [
            'id',
            'project_code',
            'project_name',
            'description',
            'client',
            'client_details',
            'quotation',
            'status',
            'project_manager',
            'project_manager_details',
            'assigned_team_members',
            'assigned_team_members_details',
            'start_date',
            'due_date',
            'completed_at',
            'budget',
            'currency',
            'progress_percentage',
            'milestones',
            'tasks',
            'activities',
            'created_by',
            'created_at',
            'updated_at',
        ]
        read_only_fields = ['id', 'project_code', 'created_by', 'created_at', 'updated_at']
