# Root4Tech CRM - Complete Agency Management System

A high-performance, secure, responsive internal CRM platform built for **Root4Tech**, an elite digital agency with specialized teams in Web Development, Video Production, Brand Design, and Growth Marketing.

Built with **Python / Django 5**, **Django REST Framework**, **ReportLab PDF Engine**, **SQLite (Local) / PostgreSQL (Production)**, and a modern responsive **Bootstrap 5.3 + Vanilla JavaScript** frontend.

---

## 🌟 Key Architecture & Capabilities

1. **Follow-Up Automation & Notifications**:
   - Automated inspection of upcoming and overdue follow-up meetings and calls.
   - Proactive notifications dispatched to salespeople for scheduled activities.
   - Escalation alerts to Sales Managers for overdue follow-ups and stagnant leads.
   - Configurable email reminder notifications with strict **24-hour anti-duplicate thresholds**.
   - Standalone management command: `python manage.py check_followups [--dry-run] [--force]`.

2. **Project Workflow & Multi-Round Review Engine**:
   - 1-click **Convert Won Deal to Project** (`POST /api/leads/<id>/create-project/`).
   - Intelligent auto-assignment: dynamically assigns Developer or Video Editor based on service requested.
   - Progress bar, milestone checklist, deadline countdowns, and revision round tracking (`revisions_count`).
   - Status progression lifecycle: `Planning` → `Active` → `Ready for Review` → `In Review` (Revision) → `Completed`.
   - Security controls: Developers and Video Editors can submit work as *Ready for Review*, while project completion sign-off is restricted to Sales Managers and Administrators.
   - Comprehensive audit logging (`ActivityLog`) on every status transition.

3. **Executive Reports & Analytics**:
   - Dynamic metrics calculation endpoint: `GET /api/reports/?start_date=YYYY-MM-DD&end_date=YYYY-MM-DD`.
   - Lead analytics: breakdown by pipeline stage, acquisition source, and overall conversion rate percentage.
   - Salesperson performance scorecards: individual win rates, deal counts, and won revenue.
   - Project health metrics: active vs. completed vs. on-hold projects, overdue task counters, and team workload distribution.
   - Financial statement reporting: total invoiced amount, payments received, and outstanding accounts receivable balance.
   - Permission-controlled CSV exports (`/api/reports/export-csv/?report_type=leads|projects|financial`).

4. **Quotations, Invoices, Payments & Server-side PDF Engine**:
   - Native vector PDF generation powered by **ReportLab 5.0+** (`generate_invoice_pdf` and `generate_quotation_pdf`).
   - Branded PDF downloads accessible via `/api/invoices/<id>/pdf/` and `/api/quotations/<id>/pdf/`.
   - Financial mathematics with decimal precision: `subtotal`, configurable `tax_rate`, `discount_amount`, and net total.
   - Multi-service itemized line-items (`BillingItem`).
   - Payment recording workflow (`POST /api/invoices/<id>/record-payment/`): auto-calculates `paid_amount` and transitions invoice status between `Sent`, `Partially Paid`, and `Paid`.
   - *Payment Gateway Disclaimer*: The system maintains verified ledger records and financial statements. Direct online credit card/merchant charging requires integrating actual gateway credentials (e.g. Stripe, PayPal, or LemonSqueezy).

5. **Agency CMS & Settings**:
   - Database-backed configuration (`AgencySetting` model) exposed via `/api/settings/agency/`.
   - Custom branding, official contact email, default tax rates, and follow-up reminder windows.
   - Role-based security: All staff members can view settings, but write updates (`PUT`/`PATCH`) strictly require Administrator privileges (non-admins receive HTTP 403 Forbidden).

---

## 👥 Staff Roles & Default Credentials

The system is configured for the authentic Root4Tech team members plus an Agency Administrator:

| Team Member | Username | Role Key | Email | Login Password | Responsibilities |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Sir Sharjeel** | `sharjeel` | `sales_mgr` | `sharjeel@root4tech.com` | `Sharjeel@Root4Tech2026!` | Sales Manager: Pipeline oversight, deal approvals, billing & analytics |
| **Sir Ali** | `ali` | `dev` | `ali@root4tech.com` | `Ali@Root4Tech2026!` | Full-Stack Developer: Web & mobile app development, dev reviews |
| **Sir Murad** | `murad` | `editor` | `murad@root4tech.com` | `Murad@Root4Tech2026!` | Video Editor: Commercial video cuts, DaVinci/Premiere, revision delivery |
| **Root4Tech Admin** | `admin` | `admin` | `admin@root4tech.com` | `Admin@Root4Tech2026!` | Agency Administrator: Full system oversight, CMS settings, access control |

*Note: All email addresses and login passwords can be updated directly inside the CRM under the [Team Members](file:///e:/Root%204%20Tech%20CRM/team.html) page or via Django Admin.*

---

## 💻 Local Windows Setup Guide

### 1. Prerequisites
- **Python 3.10+** (tested on Python 3.10, 3.11, 3.12, 3.13, and 3.14 on Windows)
- **Git**
- Optional: PostgreSQL 14+ (for production testing)

### 2. Environment Setup (PowerShell / Command Prompt)

Open PowerShell and navigate to the project root directory:

```powershell
# Navigate to the workspace
cd "e:\Root 4 Tech CRM"

# Create a Python virtual environment (if not already present)
python -m venv venv

# Activate the virtual environment
.\venv\Scripts\Activate.ps1
# Or in CMD:
# .\venv\Scripts\activate.bat

# Upgrade pip and install all required dependencies
pip install --upgrade pip
pip install -r requirements.txt
```

### 3. Environment Variables Configuration

Copy the sample environment file to create your local `.env`:

```powershell
Copy-Item .env.example .env
```

Default configuration in `.env` runs out-of-the-box with local SQLite.

### 4. Database Initialization & Seeding

Apply all Django database migrations and seed realistic agency mock data:

```powershell
# Run database schema migrations
python manage.py migrate

# Seed agency services, clients, staff personas, projects, leads, and settings
python manage.py seed_crm_data
```

### 5. Start the Development Server

```powershell
python manage.py runserver 8000
```

Open your browser and navigate to:
- **CRM Portal**: [http://127.0.0.1:8000/](http://127.0.0.1:8000/) or [http://127.0.0.1:8000/login/](http://127.0.0.1:8000/login/)
- **Django Admin Panel**: [http://127.0.0.1:8000/admin/](http://127.0.0.1:8000/admin/)
- **REST API Endpoints**: [http://127.0.0.1:8000/api/crm/bundle/](http://127.0.0.1:8000/api/crm/bundle/)

---

## ⚙️ Environment Variables Reference

All configuration is controlled via environment variables read through `python-dotenv`:

| Variable | Default Value | Description |
| :--- | :--- | :--- |
| `SECRET_KEY` | `django-insecure-...` | Cryptographic signing key (must be changed in production) |
| `DEBUG` | `True` | Set to `False` in production environments |
| `ALLOWED_HOSTS` | `localhost,127.0.0.1` | Comma-separated list of host/domain names |
| `DATABASE_ENGINE` | `sqlite` | Choose `sqlite` for development or `postgresql` for production |
| `POSTGRES_DB` | `root4tech_crm` | PostgreSQL database name |
| `POSTGRES_USER` | `crm_user` | PostgreSQL database user |
| `POSTGRES_PASSWORD` | `securepassword` | PostgreSQL database password |
| `POSTGRES_HOST` | `localhost` | PostgreSQL host |
| `POSTGRES_PORT` | `5432` | PostgreSQL port |
| `EMAIL_BACKEND` | `django.core.mail.backends.console.EmailBackend` | Set to `django.core.mail.backends.smtp.EmailBackend` in production |
| `EMAIL_HOST` | `smtp.gmail.com` | SMTP email server host |
| `EMAIL_PORT` | `587` | SMTP port (587 for TLS, 465 for SSL) |
| `EMAIL_USE_TLS` | `True` | Enable TLS encryption |
| `EMAIL_HOST_USER` | `notifications@root4tech.com` | SMTP outgoing username |
| `EMAIL_HOST_PASSWORD` | `app-specific-password` | SMTP authentication password or app token |
| `DEFAULT_FROM_EMAIL` | `Root4Tech CRM <notifications@root4tech.com>` | Sender header on automated emails |
| `SECURE_SSL_REDIRECT` | `False` | Enforce HTTPS redirect (Set `True` behind SSL certificates) |

---

## 🤖 Automated Follow-Up Worker & Scheduling Guide

The follow-up engine scans for pending appointments, escalates overdue tasks, and dispatches email/in-app notifications without duplicate alerts within 24 hours.

### Running the Command Manually

```powershell
# Standard run (processes alerts and logs notifications)
python manage.py check_followups

# Dry-run mode (simulates actions without database writes or sending emails)
python manage.py check_followups --dry-run

# Force mode (bypasses the 24-hour deduplication threshold)
python manage.py check_followups --force
```

### Scheduling on Windows (Windows Task Scheduler)

To run the automation check daily at 9:00 AM on Windows:

1. Open PowerShell as Administrator.
2. Register a scheduled task executing the command:
   ```powershell
   $Action = New-ScheduledTaskAction -Execute "python.exe" `
     -Argument "manage.py check_followups" `
     -WorkingDirectory "e:\Root 4 Tech CRM"

   $Trigger = New-ScheduledTaskTrigger -Daily -At 9:00AM

   Register-ScheduledTask -TaskName "Root4Tech_CRM_FollowUp_Checker" `
     -Action $Action -Trigger $Trigger `
     -Description "Daily automated follow-up & overdue reminder check for Root4Tech CRM"
   ```

### Scheduling on Linux (Cron)

Add the following entry to your crontab (`crontab -e`):

```bash
# Run every day at 9:00 AM
0 9 * * * cd /var/www/root4tech-crm && /var/www/root4tech-crm/venv/bin/python manage.py check_followups >> /var/log/crm_followups.log 2>&1
```

---

## 🧪 Automated Test Suite

The test suite validates models, relationships, permissions across all 4 roles + admin, lead conversion, project workflows, PDF generation, and reports analytics:

```powershell
# Run the complete test suite
python manage.py test crm

# Run specific Phase 3 workflow tests
python manage.py test crm.tests.CrudAPITests.test_check_followups_command_and_deduplication
python manage.py test crm.tests.CrudAPITests.test_invoice_pdf_generator
python manage.py test crm.tests.CrudAPITests.test_create_project_from_won_deal
python manage.py test crm.tests.CrudAPITests.test_project_review_and_completion_workflow
python manage.py test crm.tests.CrudAPITests.test_reports_analytics_calculation_and_filtering
python manage.py test crm.tests.CrudAPITests.test_agency_settings_cms_and_admin_security
```

---

## 🚀 Production Deployment Checklist

### 1. Database Setup (PostgreSQL)
1. Install PostgreSQL 14+ on the server.
2. Create database and user:
   ```sql
   CREATE DATABASE root4tech_crm;
   CREATE USER crm_user WITH ENCRYPTED PASSWORD 'StrongProductionPassword!';
   GRANT ALL PRIVILEGES ON DATABASE root4tech_crm TO crm_user;
   ```
3. Set `DATABASE_ENGINE=postgresql` and relevant credentials in `.env`.

### 2. Static Files & Environment
```bash
# Set production flags in .env
DEBUG=False
SECURE_SSL_REDIRECT=True
SESSION_COOKIE_SECURE=True
CSRF_COOKIE_SECURE=True

# Collect static assets into staticfiles directory
python manage.py collectstatic --noinput
```

### 3. Application Server
- **Windows Server**: Run with **Waitress**:
  ```powershell
  pip install waitress
  waitress-serve --port=8000 root4tech_crm.wsgi:application
  ```
- **Linux Server**: Run with **Gunicorn**:
  ```bash
  pip install gunicorn
  gunicorn root4tech_crm.wsgi:application --workers 4 --bind 127.0.0.1:8000
  ```

### 4. Reverse Proxy (Nginx)
Configure Nginx as a reverse proxy with Let's Encrypt SSL:

```nginx
server {
    listen 80;
    server_name crm.root4tech.com;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    server_name crm.root4tech.com;

    ssl_certificate /etc/letsencrypt/live/crm.root4tech.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/crm.root4tech.com/privkey.pem;

    location /static/ {
        alias /var/www/root4tech-crm/staticfiles/;
    }

    location / {
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

---

## 💾 Database Backup & Disaster Recovery

### SQLite Backup & Restore (Local / Staging)

```powershell
# Backup:
Copy-Item "e:\Root 4 Tech CRM\db.sqlite3" "e:\Root 4 Tech CRM\backups\db_backup_$(Get-Date -Format 'yyyyMMdd_HHmmss').sqlite3"

# Restore:
Copy-Item "e:\Root 4 Tech CRM\backups\db_backup_20261014.sqlite3" "e:\Root 4 Tech CRM\db.sqlite3"
```

### PostgreSQL Backup & Restore (Production)

```bash
# Backup:
pg_dump -U crm_user -h localhost -d root4tech_crm -F c -b -v -f "/backups/crm_backup_$(date +%Y%m%d_%H%M%S).dump"

# Restore:
pg_restore -U crm_user -h localhost -d root4tech_crm -v --clean "/backups/crm_backup_20261014_120000.dump"
```

---

## 🔌 External Services & Integration Checklist

1. **SMTP Email Delivery**:
   - Provide valid SMTP credentials in `.env` (`EMAIL_HOST`, `EMAIL_PORT`, `EMAIL_HOST_USER`, `EMAIL_HOST_PASSWORD`).
   - For Gmail, use an [App Password](https://myaccount.google.com/apppasswords) with 2-Step Verification.
   - For SendGrid / Postmark / Mailgun, use API keys as the SMTP password.

2. **Database Storage**:
   - Local: Bundled SQLite (`db.sqlite3`).
   - Production: Managed PostgreSQL (Amazon RDS, DigitalOcean Managed DB, or Supabase).

3. **Merchant Payment Gateway (Optional / Add-on)**:
   - The CRM natively generates legal PDF invoices, tracks partial/full wire payments, and logs transaction numbers.
   - To accept customer credit cards online directly through customer-facing payment links, integrate Stripe Webhooks (`stripe-python`) with Stripe API keys (`STRIPE_PUBLIC_KEY`, `STRIPE_SECRET_KEY`).

---

## 📄 License & Attribution

Copyright © 2026 Root4Tech Digital Agency. All rights reserved.
Developed for internal operations and agency team workflows.
