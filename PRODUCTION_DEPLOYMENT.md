# Roo4Tech Smart CRM — Production Deployment & Operations Manual
**Phase 3: Production Readiness, Advanced Security & AI Assistant Integration**

---

## 1. Architecture Overview

Roo4Tech Smart CRM is architected as a high-performance, enterprise-grade multi-tier application:

```
                  +-----------------------------------+
                  |          Internet / Users         |
                  +-----------------+-----------------+
                                    | HTTPS (443)
                  +-----------------v-----------------+
                  |      Nginx Reverse Proxy          |
                  |  - SSL Termination                |
                  |  - Security Headers (HSTS, CSP)   |
                  |  - SSE Streaming (Zero Buffering) |
                  |  - Static / Media Asset Serving   |
                  +--------+-----------------+--------+
                           |                 |
       /api/ & /admin/     |                 | / (All web routes)
+--------------------------v---+    +--------v----------------------+
| Django REST Framework API    |    | Next.js 16 Web Application    |
| (Gunicorn WSGI Workers)      |    | (Node.js Production Runtime)  |
| - JWT & Role-Based Auth      |    | - React 19 Client & Server UI |
| - Centralized Client ID      |    | - Tailwind CSS & Lucide Icons |
| - Two-Phase AI Assistant     |    | - ChatGPT-like Stream UI      |
+--------------+---------------+    +-------------------------------+
               |
+--------------v---------------+
| Managed PostgreSQL 16 DB     |
| (or SQLite for local dev)    |
| - Audit Logs & Snapshots     |
| - Persistent Client Records  |
+------------------------------+
```

---

## 2. Environment Variables & Secret Configuration

Production secrets must never be committed to Git. The project includes template files with safe placeholders:
- Backend: [`backend/.env.example`](file:///e:/Root4tech-CRM/backend/.env.example)
- Frontend: [`frontend/.env.example`](file:///e:/Root4tech-CRM/frontend/.env.example)

### Backend Configuration (`backend/.env`)

| Variable | Description | Example / Recommendation |
|---|---|---|
| `SECRET_KEY` | High-entropy random key for Django sessions and token signing. | `python -c "import secrets; print(secrets.token_urlsafe(50))"` |
| `DEBUG` | **Must always be `False` in production.** | `False` |
| `ALLOWED_HOSTS` | Comma-separated list of trusted hostnames. | `crm.roo4tech.com,api.roo4tech.com` |
| `CSRF_TRUSTED_ORIGINS` | Trusted origins for CSRF protection. | `https://crm.roo4tech.com` |
| `CORS_ALLOWED_ORIGINS` | Allowed frontend domains for CORS. | `https://crm.roo4tech.com` |
| `SECURE_SSL_REDIRECT` | Enforces HTTPS on all requests. | `True` |
| `DATABASE_URL` | PostgreSQL connection string. | `postgres://roo4tech_admin:SecretPass@localhost:5432/roo4tech_crm` |
| `AI_PROVIDER` | Active LLM provider (`openai`, `gemini`, `anthropic`, `mock`). | `openai` |
| `AI_MODEL` | Provider model name. | `gpt-4o-mini` |
| `OPENAI_API_KEY` | Secret API key for OpenAI model calls. | `sk-...` |
| `DEFAULT_CURRENCY` | Default business currency. | `PKR` |
| `COMPANY_NAME` | Organization branding name. | `Roo4Tech` |

### Frontend Configuration (`frontend/.env.local` or container environment)

| Variable | Description | Production Value |
|---|---|---|
| `NEXT_PUBLIC_API_URL` | Public URL to Django backend API. | `https://crm.roo4tech.com/api` |

---

## 3. Database Backup & Disaster Recovery

### Automated Backup
Run the safe backup script anytime before applying migrations or schema updates:
```bash
python backend/scripts/backup_db.py
```
- For **SQLite**: Creates an online, non-blocking hot copy under `backend/backups/crm_backup_sqlite_<timestamp>.sqlite3`.
- For **PostgreSQL**: Invokes `pg_dump -Fc` producing a compressed dump under `backend/backups/crm_backup_postgres_<timestamp>.dump`.

### Database Restoration & Rollback
To restore the database from an existing verified backup:
```bash
python backend/scripts/restore_db.py backend/backups/<backup_filename>
```
> [!IMPORTANT]
> Never assume code rollbacks reverse database migrations. Always verify and restore the database snapshot first if schema migration errors occur.

---

## 4. Docker Production Deployment (Recommended)

The repository provides a complete, multi-container Docker configuration:
- [`Dockerfile`](file:///e:/Root4tech-CRM/backend/Dockerfile) (Django backend)
- [`Dockerfile`](file:///e:/Root4tech-CRM/frontend/Dockerfile) (Next.js frontend)
- [`nginx.conf`](file:///e:/Root4tech-CRM/nginx/nginx.conf) (Reverse proxy with SSE support)
- [`docker-compose.yml`](file:///e:/Root4tech-CRM/docker-compose.yml) (Orchestration)

### Deployment Steps:
1. Ensure Docker and Docker Compose are installed on the server.
2. Clone repository to server:
   ```bash
   git clone <repo_url> /var/www/roo4tech-crm
   cd /var/www/roo4tech-crm
   ```
3. Create backend `.env` file from example:
   ```bash
   cp backend/.env.example backend/.env
   # Edit backend/.env with your production secrets and API keys
   nano backend/.env
   ```
4. Build and start services:
   ```bash
   docker compose up -d --build
   ```
5. Apply database migrations inside the backend container:
   ```bash
   docker compose exec backend python manage.py migrate
   ```
6. Collect static assets:
   ```bash
   docker compose exec backend python manage.py collectstatic --no-input
   ```
7. Create the production superuser (if not already existing):
   ```bash
   docker compose exec backend python manage.py createsuperuser
   ```
8. Verify health status:
   ```bash
   curl -i http://localhost/api/health/
   ```

---

## 5. Bare-Metal / Ubuntu Linux Deployment (Alternative)

If deploying directly to a Linux VPS (e.g. AWS EC2, DigitalOcean, Hetzner, Linode):

### A. Backend Service (systemd)
Create `/etc/systemd/system/roo4tech-backend.service`:
```ini
[Unit]
Description=Roo4Tech CRM Django Backend
After=network.target postgresql.service

[Service]
User=www-data
Group=www-data
WorkingDirectory=/var/www/roo4tech-crm/backend
ExecStart=/var/www/roo4tech-crm/backend/venv/bin/gunicorn core.wsgi:application \
    --workers 3 \
    --bind 127.0.0.1:8000 \
    --timeout 90
Restart=always

[Install]
WantedBy=multi-user.target
```

### B. Frontend Service (systemd or PM2)
```bash
cd /var/www/roo4tech-crm/frontend
npm ci
npm run build
pm2 start npm --name "roo4tech-frontend" -- start
pm2 save
pm2 startup
```

### C. Nginx & Let's Encrypt SSL
Link [`nginx/nginx.conf`](file:///e:/Root4tech-CRM/nginx/nginx.conf) to `/etc/nginx/sites-available/roo4tech` and enable it. Obtain an SSL certificate:
```bash
certbot --nginx -d crm.roo4tech.com
```

---

## 6. Health Check & Monitoring

A dedicated public health check endpoint is available at `/api/health/`:
- **Endpoint:** `GET /api/health/`
- **Response:**
  ```json
  {
    "status": "healthy",
    "service": "Root4Tech Smart CRM API",
    "version": "3.0.0",
    "database": "healthy"
  }
  ```
- **HTTP Status Codes:**
  - `200 OK`: Database connected and operational.
  - `503 Service Unavailable`: Database disconnected or experiencing latency/failures.

---

## 7. AI Assistant Configuration & Usage Policy

The AI Assistant is protected by **Two-Phase Action Verification**:
1. **Model Proposal Phase:** The AI validates arguments, checks for duplicates, and creates a secure action proposal token (expiring in 30 minutes).
2. **User Confirmation Phase:** The CRM user explicitly reviews the proposal card and clicks **Confirm & Execute**.
3. **Execution:** The action executes atomically within a database transaction, updates the proposal status to `EXECUTED`, and records an entry in `AuditLog`.

### Setting the AI Provider:
Administrators can switch providers either via environment variables or through the CRM settings:
- `AI_PROVIDER=openai` (requires `OPENAI_API_KEY`)
- `AI_PROVIDER=gemini` (requires `GEMINI_API_KEY`)
- `AI_PROVIDER=anthropic` (requires `ANTHROPIC_API_KEY`)
- `AI_PROVIDER=mock` (internal deterministic engine for testing)
