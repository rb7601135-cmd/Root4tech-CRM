from django.contrib import admin
from django.urls import path, include
from django.conf import settings
from django.conf.urls.static import static

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/', include('apps.accounts.urls')),
    path('api/', include('apps.clients.urls')),
    path('api/', include('apps.leads.urls')),
    path('api/company/', include('apps.company.urls')),
    path('api/dashboard/', include('apps.dashboard.urls')),
    path('api/', include('apps.quotations.urls')),
    path('api/', include('apps.invoices.urls')),
    path('api/', include('apps.projects.urls')),
    path('api/', include('apps.calendar_events.urls')),
    path('api/automation/', include('apps.automation.urls')),
    path('api/realtime/', include('apps.realtime.urls')),
    path('api/assistant/', include('apps.assistant.urls')),
    path('api/health/', include([
        path('', __import__('apps.company.views', fromlist=['health_check']).health_check, name='health-check'),
    ])),
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
