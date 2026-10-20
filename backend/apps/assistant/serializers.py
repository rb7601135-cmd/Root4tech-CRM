from rest_framework import serializers
from .models import Conversation, ChatMessage, ActionProposal, AssistantSetting

class ChatMessageSerializer(serializers.ModelSerializer):
    class Meta:
        model = ChatMessage
        fields = ['id', 'conversation', 'role', 'content', 'metadata', 'created_at']
        read_only_fields = ['id', 'created_at']


class ConversationSerializer(serializers.ModelSerializer):
    messages = ChatMessageSerializer(many=True, read_only=True)
    message_count = serializers.SerializerMethodField()

    class Meta:
        model = Conversation
        fields = ['id', 'title', 'is_archived', 'created_at', 'updated_at', 'message_count', 'messages']
        read_only_fields = ['id', 'created_at', 'updated_at']

    def get_message_count(self, obj):
        return obj.messages.count()


class ActionProposalSerializer(serializers.ModelSerializer):
    class Meta:
        model = ActionProposal
        fields = ['id', 'token', 'action_type', 'preview_data', 'status', 'execution_result', 'created_at', 'expires_at']
        read_only_fields = ['id', 'token', 'created_at']


class AssistantSettingSerializer(serializers.ModelSerializer):
    class Meta:
        model = AssistantSetting
        fields = ['provider', 'model_name', 'temperature', 'max_tokens', 'is_enabled', 'allowed_roles', 'updated_at']
        read_only_fields = ['updated_at']
