import json
from rest_framework import status, views, viewsets
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser
from django.http import StreamingHttpResponse
from django.shortcuts import get_object_or_404
from django.db.models import Q
from django.core.exceptions import ValidationError

from .models import Conversation, ChatMessage, ActionProposal, AssistantSetting
from .serializers import ConversationSerializer, ChatMessageSerializer, ActionProposalSerializer, AssistantSettingSerializer
from .services.ai_engine import AIEngine
from .services.document_parser import validate_and_extract_text
from .tools.crm_tools import execute_action_proposal
from apps.company.models import record_audit_log

class ConversationViewSet(viewsets.ModelViewSet):
    serializer_class = ConversationSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        # Strict isolation: Users can only see their own conversations
        qs = Conversation.objects.filter(user=self.request.user)
        search = self.request.query_params.get('search')
        if search:
            qs = qs.filter(Q(title__icontains=search.strip()) | Q(messages__content__icontains=search.strip())).distinct()
        
        archived = self.request.query_params.get('archived')
        if archived is not None:
            is_archived = archived.lower() in ('true', '1', 't')
            qs = qs.filter(is_archived=is_archived)

        return qs.order_by('-updated_at')

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)

    def perform_destroy(self, instance):
        record_audit_log(
            user=self.request.user,
            action='DELETE_CONVERSATION',
            module='AUTH',
            entity_id=str(instance.id),
            description=f"User deleted conversation '{instance.title}'"
        )
        instance.delete()


class SendMessageStreamView(views.APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, conversation_id):
        conversation = get_object_or_404(Conversation, id=conversation_id, user=request.user)

        user_content = request.data.get('message', '').strip()
        document_context = request.data.get('document_context', '').strip()

        if not user_content:
            return Response({"error": "Message content cannot be empty."}, status=status.HTTP_400_BAD_REQUEST)

        # 1. Save user message to database
        user_msg = ChatMessage.objects.create(
            conversation=conversation,
            role=ChatMessage.Role.USER,
            content=user_content,
            metadata={"has_document_context": bool(document_context)}
        )

        # Update conversation title if this is the first message and title is default
        if conversation.messages.count() <= 1 and conversation.title == 'New Conversation':
            first_words = " ".join(user_content.split()[:6])
            conversation.title = (first_words[:45] + '...') if len(first_words) > 45 else first_words
            conversation.save(update_fields=['title', 'updated_at'])
        else:
            conversation.save(update_fields=['updated_at'])

        # 2. Build history
        history_msgs = []
        # Get past 15 messages for context
        past_msgs = conversation.messages.order_by('created_at')[:15]
        for m in past_msgs:
            history_msgs.append({"role": m.role, "content": m.content})

        # 3. Stream generator wrapper that accumulates the assistant's final response
        engine = AIEngine(user=request.user, conversation=conversation)
        
        def sse_stream_wrapper():
            accumulated_text = []
            verified_facts = []
            action_proposals = []

            for chunk_line in engine.stream_chat(history_msgs, document_context):
                yield chunk_line

                # Parse chunk to collect final message content
                if chunk_line.startswith('data: '):
                    try:
                        data = json.loads(chunk_line[6:].strip())
                        evt_type = data.get('type')
                        if evt_type == 'content':
                            accumulated_text.append(data.get('delta', ''))
                        elif evt_type == 'proposal':
                            action_proposals.append(data)
                        elif evt_type == 'tool_call':
                            verified_facts.append(data.get('tool'))
                    except Exception:
                        pass

            # Save assistant message to DB after stream finishes
            full_reply = "".join(accumulated_text).strip()
            if full_reply or action_proposals:
                ChatMessage.objects.create(
                    conversation=conversation,
                    role=ChatMessage.Role.ASSISTANT,
                    content=full_reply if full_reply else "Prepared action proposal. Please review below.",
                    metadata={
                        "tools_called": verified_facts,
                        "proposals": [p.get('action_token') for p in action_proposals],
                        "provider": engine.provider,
                        "model": engine.model
                    }
                )

        response = StreamingHttpResponse(sse_stream_wrapper(), content_type='text/event-stream')
        response['Cache-Control'] = 'no-cache'
        response['X-Accel-Buffering'] = 'no'
        return response


class ExecuteActionProposalView(views.APIView):
    """
    Confirmed Consequential Action Execution Endpoint.
    Requires user confirmation and token. Executes atomically in DB.
    """
    permission_classes = [IsAuthenticated]

    def post(self, request):
        token = request.data.get('action_token')
        confirmed = request.data.get('confirm', False)

        if not token:
            return Response({"error": "Action token is required."}, status=status.HTTP_400_BAD_REQUEST)

        if not confirmed:
            # User cancelled the action
            proposal = ActionProposal.objects.filter(token=token, user=request.user).first()
            if proposal and proposal.status == ActionProposal.Status.PENDING:
                proposal.status = ActionProposal.Status.CANCELLED
                proposal.save(update_fields=['status'])
            return Response({"message": "Action cancelled by user.", "status": "CANCELLED"})

        result = execute_action_proposal(request.user, token)
        if not result.get('success'):
            return Response({"error": result.get('error', 'Execution failed.')}, status=status.HTTP_400_BAD_REQUEST)

        return Response(result, status=status.HTTP_200_OK)


class DocumentUploadView(views.APIView):
    """
    Secure document parser endpoint for PDF, TXT, CSV, DOCX.
    Validates file format, restricts size, safely extracts plain text.
    """
    permission_classes = [IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser]

    def post(self, request):
        uploaded_file = request.FILES.get('file')
        if not uploaded_file:
            return Response({"error": "No file uploaded."}, status=status.HTTP_400_BAD_REQUEST)

        try:
            extracted_text = validate_and_extract_text(uploaded_file)
            return Response({
                "filename": uploaded_file.name,
                "file_size": uploaded_file.size,
                "extracted_text": extracted_text,
                "char_count": len(extracted_text),
                "untrusted_notice": "Extracted text has been sanitized and will be processed as untrusted input."
            }, status=status.HTTP_200_OK)
        except ValidationError as ve:
            return Response({"error": str(ve.message if hasattr(ve, 'message') else ve)}, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            return Response({"error": f"Failed to upload document: {str(e)}"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class AssistantConfigView(views.APIView):
    """
    Configuration endpoint.
    GET: Current assistant settings and provider status.
    PATCH: Update settings (Admin only).
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        setting = AssistantSetting.get_solo()
        serializer = AssistantSettingSerializer(setting)
        engine = AIEngine(user=request.user)
        return Response({
            "settings": serializer.data,
            "is_configured": engine.is_configured(),
            "active_provider": engine.provider,
            "active_model": engine.model,
            "supported_providers": ["openai", "gemini", "anthropic", "mock"]
        })

    def patch(self, request):
        if not request.user.is_administrator:
            return Response({"error": "Admin permission required."}, status=status.HTTP_403_FORBIDDEN)

        setting = AssistantSetting.get_solo()
        serializer = AssistantSettingSerializer(setting, data=request.data, partial=True)
        if serializer.is_valid():
            serializer.save(updated_by=request.user)
            record_audit_log(
                user=request.user,
                action='UPDATE_AI_CONFIG',
                module='SETTINGS',
                description=f"Admin updated AI Assistant config: provider={setting.provider}, model={setting.model_name}"
            )
            return Response(serializer.data)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
