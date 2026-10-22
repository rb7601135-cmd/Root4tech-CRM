#!/bin/sh
set -e

echo "=== Starting Roo4Tech CRM Backend Container ==="

# Apply database migrations on Supabase/PostgreSQL
echo "Applying database migrations..."
python manage.py migrate --noinput

# Collect static files for Django admin and REST framework
echo "Collecting static files..."
python manage.py collectstatic --noinput || true

# Determine port (Back4App or standard 8000)
PORT="${PORT:-8000}"
echo "Starting Gunicorn on 0.0.0.0:$PORT..."

exec gunicorn core.wsgi:application --bind "0.0.0.0:$PORT" --workers 3 --timeout 90
