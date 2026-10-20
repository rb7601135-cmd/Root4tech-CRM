from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    ConversationViewSet,
    SendMessageStreamView,
    ExecuteActionProposalView,
    DocumentUploadView,
    AssistantConfigView
)

router = DefaultRouter()
router.register(r'conversations', ConversationViewSet, basename='assistant-conversation')

urlpatterns = [
    path('', include(router.urls)),
    path('conversations/<uuid:conversation_id>/messages/stream/', SendMessageStreamView.as_view(), name='assistant-stream-message'),
    path('actions/execute/', ExecuteActionProposalView.as_view(), name='assistant-execute-action'),
    path('documents/upload/', DocumentUploadView.as_view(), name='assistant-upload-document'),
    path('config/', AssistantConfigView.as_view(), name='assistant-config'),
]
