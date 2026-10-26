import os
from pathlib import Path
from datetime import timedelta
import dotenv

# Build paths inside the project like this: BASE_DIR / 'subdir'.
BASE_DIR = Path(__file__).resolve().parent.parent

# Load environment variables
dotenv.load_dotenv(BASE_DIR / '.env')

SECRET_KEY = os.getenv('SECRET_KEY', 'django-insecure-roo4tech-crm-default-key-2026-phase1')

DEBUG = os.getenv('DEBUG', 'True').lower() in ('true', '1', 't')

ALLOWED_HOSTS = ['*'] if DEBUG else [host.strip() for host in os.getenv('ALLOWED_HOSTS', 'localhost,127.0.0.1').split(',') if host.strip()]

# Application definition
INSTALLED_APPS = [
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',

    # Third-party
    'rest_framework',
    'rest_framework_simplejwt',
    'corsheaders',

    # Internal CRM Apps
    'apps.accounts',
    'apps.clients',
    'apps.leads',
    'apps.company',
    'apps.dashboard',
    'apps.quotations',
    'apps.invoices',
    'apps.projects',
    'apps.calendar_events',
    'apps.automation',
    'apps.realtime',
    'apps.assistant',
]

MIDDLEWARE = [
    'corsheaders.middleware.CorsMiddleware',
    'django.middleware.security.SecurityMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
]

ROOT_URLCONF = 'core.urls'

TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'DIRS': [BASE_DIR / 'templates'],
        'APP_DIRS': True,
        'OPTIONS': {
            'context_processors': [
                'django.template.context_processors.debug',
                'django.template.context_processors.request',
                'django.contrib.auth.context_processors.auth',
                'django.contrib.messages.context_processors.messages',
            ],
        },
    },
]

WSGI_APPLICATION = 'core.wsgi.application'

# Database
# Support PostgreSQL when DATABASE_URL is set, otherwise default to SQLite3 for dev/testing
DATABASE_URL = os.getenv('DATABASE_URL', '').strip().strip("'\"")

def parse_database_url(raw_url: str):
    """
    Safely parses a PostgreSQL DATABASE_URL.
    Handles RFC 3986 bracketed non-IP hosts (e.g. @[HOST] or @[domain]) which trigger
    ValueError: 'HOST' does not appear to be an IPv4 or IPv6 address in Python 3.12+.
    Detects unconfigured placeholders and falls back gracefully to SQLite.
    """
    if not raw_url or not raw_url.startswith(('postgres://', 'postgresql://')):
        return None

    import urllib.parse as urlparse
    import re
    import ipaddress

    # Pre-clean: strip brackets if the content inside @[...] is not a valid IPv6/IPv4 address
    def fix_bracketed_host(match):
        host = match.group(1)
        try:
            ipaddress.ip_address(host)
            return f"@[{host}]"
        except ValueError:
            return f"@{host}"

    cleaned_url = re.sub(r'@\[([^\]]+)\]', fix_bracketed_host, raw_url)

    try:
        url = urlparse.urlparse(cleaned_url)
    except Exception as e:
        print(f"[WARNING] Could not parse DATABASE_URL ({e}). Falling back to SQLite.")
        return None

    hostname = (url.hostname or '').strip()

    # Detect unconfigured template placeholders like 'HOST', '[HOST]', '[YOUR-PASSWORD]', etc.
    is_placeholder = (
        not hostname
        or hostname.lower() in ('host', '[host]', 'your-host')
        or '[your-password]' in raw_url.lower()
        or '[region]' in raw_url.lower()
    )

    if is_placeholder:
        print("=" * 70)
        print("[WARNING] DATABASE_URL contains unconfigured placeholders or invalid host:")
        print(f"  Detected Host: {hostname or 'None'}")
        print("  Please configure DATABASE_URL in your deployment platform's Environment Variables.")
        print("  Falling back to SQLite database.")
        print("=" * 70)
        return None

    query_params = urlparse.parse_qs(url.query)
    is_supabase = 'supabase.co' in hostname or 'supabase.com' in hostname
    ssl_mode = query_params.get('sslmode', ['require' if is_supabase else 'prefer'])[0]

    db_options = {}
    if ssl_mode:
        db_options['sslmode'] = ssl_mode

    return {
        'ENGINE': 'django.db.backends.postgresql',
        'NAME': urlparse.unquote(url.path[1:]) if url.path else 'postgres',
        'USER': urlparse.unquote(url.username or ''),
        'PASSWORD': urlparse.unquote(url.password or ''),
        'HOST': hostname,
        'PORT': str(url.port or '5432'),
        'CONN_MAX_AGE': 600,
        'CONN_HEALTH_CHECKS': True,
        'OPTIONS': db_options,
    }

parsed_db = parse_database_url(DATABASE_URL)
if parsed_db:
    DATABASES = {'default': parsed_db}
else:
    DATABASES = {
        'default': {
            'ENGINE': 'django.db.backends.sqlite3',
            'NAME': BASE_DIR / 'db.sqlite3',
        }
    }

AUTH_USER_MODEL = 'accounts.User'

# Password validation
AUTH_PASSWORD_VALIDATORS = [
    {
        'NAME': 'django.contrib.auth.password_validation.UserAttributeSimilarityValidator',
    },
    {
        'NAME': 'django.contrib.auth.password_validation.MinimumLengthValidator',
        'OPTIONS': {'min_length': 8},
    },
    {
        'NAME': 'django.contrib.auth.password_validation.CommonPasswordValidator',
    },
    {
        'NAME': 'django.contrib.auth.password_validation.NumericPasswordValidator',
    },
]

# Fast password hashing during automated tests

import sys
if 'test' in sys.argv:
    PASSWORD_HASHERS = [
        'django.contrib.auth.hashers.MD5PasswordHasher',
    ]

# Internationalization

LANGUAGE_CODE = 'en-us'
TIME_ZONE = 'UTC'
USE_I18N = True
USE_TZ = True

# Static & Media files
STATIC_URL = 'static/'
STATIC_ROOT = BASE_DIR / 'staticfiles'

MEDIA_URL = '/media/'
MEDIA_ROOT = BASE_DIR / 'media'

DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'

# REST Framework
REST_FRAMEWORK = {

    'DEFAULT_AUTHENTICATION_CLASSES': (
        'rest_framework_simplejwt.authentication.JWTAuthentication',
        'rest_framework.authentication.SessionAuthentication',
    ),
    'DEFAULT_PERMISSION_CLASSES': (
        'rest_framework.permissions.IsAuthenticated',
    ),
    'DEFAULT_PAGINATION_CLASS': 'rest_framework.pagination.PageNumberPagination',
    'PAGE_SIZE': 15,
    'DEFAULT_THROTTLE_CLASSES': [
        'rest_framework.throttling.AnonRateThrottle',
        'rest_framework.throttling.UserRateThrottle',
        'rest_framework.throttling.ScopedRateThrottle',
    ],
    'DEFAULT_THROTTLE_RATES': {
        'anon': '100/day',
        'user': '2000/day',
        'auth_burst': '15/minute',
        'password_reset': '5/hour',
        'assistant': '300/hour',
    }
}

# Simple JWT
SIMPLE_JWT = {
    'ACCESS_TOKEN_LIFETIME': timedelta(hours=2),
    'REFRESH_TOKEN_LIFETIME': timedelta(days=7),
    'ROTATE_REFRESH_TOKENS': True,
    'BLACKLIST_AFTER_ROTATION': False,
    'AUTH_HEADER_TYPES': ('Bearer',),
}

# CORS & CSRF Configuration
CORS_ALLOWED_ORIGINS = [
    origin.strip() for origin in os.getenv(
        'CORS_ALLOWED_ORIGINS',
        'http://localhost:3000,http://127.0.0.1:3000'
    ).split(',') if origin.strip()
]
CSRF_TRUSTED_ORIGINS = [
    origin.strip() for origin in os.getenv(
        'CSRF_TRUSTED_ORIGINS',
        'http://localhost:3000,http://127.0.0.1:3000'
    ).split(',') if origin.strip()
]
CORS_ALLOW_CREDENTIALS = True
if DEBUG:
    CORS_ALLOW_ALL_ORIGINS = True

# Production Security Headers
if not DEBUG:
    SECURE_BROWSER_XSS_FILTER = True
    X_FRAME_OPTIONS = 'DENY'
    SECURE_CONTENT_TYPE_NOSNIFF = True
    CSRF_COOKIE_SECURE = True
    SESSION_COOKIE_SECURE = True
    SECURE_SSL_REDIRECT = os.getenv('SECURE_SSL_REDIRECT', 'False').lower() in ('true', '1', 't')

# Company Defaults
DEFAULT_CURRENCY = os.getenv('DEFAULT_CURRENCY', 'PKR')
COMPANY_NAME = os.getenv('COMPANY_NAME', 'Roo4Tech')

# Email Backend (Console backend for safe local execution and audit)
EMAIL_BACKEND = os.getenv('EMAIL_BACKEND', 'django.core.mail.backends.console.EmailBackend')
DEFAULT_FROM_EMAIL = 'contact@roo4tech.com'
