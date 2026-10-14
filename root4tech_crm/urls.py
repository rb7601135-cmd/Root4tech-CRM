"""
URL configuration for root4tech_crm project.
"""

from django.contrib import admin
from django.urls import path, include, re_path
from django.conf import settings
from django.views.static import serve
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent

urlpatterns = [
    path('admin/', admin.site.urls),
    path('', include('crm.urls')),
    
    # Direct static file serving for frontend folders (/css/, /js/, /assets/), handling subpaths
    re_path(r'^(?:.+/)?css/(?P<path>.*)$', serve, {'document_root': BASE_DIR / 'css'}),
    re_path(r'^(?:.+/)?js/(?P<path>.*)$', serve, {'document_root': BASE_DIR / 'js'}),
    re_path(r'^(?:.+/)?assets/(?P<path>.*)$', serve, {'document_root': BASE_DIR / 'assets'}),
    re_path(r'^static/(?P<path>.*)$', serve, {'document_root': BASE_DIR}),
]
