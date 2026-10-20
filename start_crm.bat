@echo off
title Roo4Tech CRM Launcher
echo ============================================================
echo   ROO4TECH SMART CRM - LAUNCHING BACKEND AND FRONTEND
echo ============================================================
echo.
echo [1/2] Starting Django REST Backend on http://127.0.0.1:8000/api/ ...
start "Roo4Tech CRM - Django Backend (:8000)" cmd /k "cd /d ""%~dp0backend"" && call venv\Scripts\activate.bat && python manage.py migrate && python manage.py runserver 0.0.0.0:8000"

timeout /t 3 /nobreak >nul

echo [2/2] Starting Next.js Frontend on http://localhost:3000/ ...
start "Roo4Tech CRM - Next.js Frontend (:3000)" cmd /k "cd /d ""%~dp0frontend"" && npm run dev"

echo.
echo ============================================================
echo   CRM SERVERS ARE RUNNING!
echo.
echo   * Web Application: http://localhost:3000
echo   * Backend REST API: http://127.0.0.1:8000/api/
echo   * Django Admin:     http://127.0.0.1:8000/admin/
echo.
echo   Default Credentials:
echo   - Admin:         admin@roo4tech.com / AdminPassword2026!
echo   - Sales Manager: salesmanager@roo4tech.com / SalesPassword2026!
echo   - Salesperson:   sales@roo4tech.com / SalesPassword2026!
echo ============================================================
pause
