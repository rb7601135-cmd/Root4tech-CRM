@echo off
echo ============================================================
echo Starting Roo4Tech CRM - Django Backend Server on :8000
echo ============================================================
cd /d "%~dp0backend"
call venv\Scripts\activate.bat
python manage.py migrate
python manage.py runserver 0.0.0.0:8000
pause
