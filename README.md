# Roo4Tech Smart CRM — Phase 1: Foundation & Core CRM

Enterprise production-ready CRM built for software house **Roo4Tech**, featuring a clearly separated Python/Django REST Framework backend and Next.js / TypeScript / Tailwind CSS frontend.

---

## 🚀 Key Features Implemented in Phase 1

### 1. Modern UI & Navigation
- **Collapsible Sidebar**: Roo4Tech branding, core navigation, upcoming Phase 2 roadmap indicators (*Quotations, Invoices, Projects*).
- **Top Navigation Bar**: Global search across leads and clients, notifications panel, quick "+ Add Lead" action, user profile menu with role badge and logout.
- **Responsive Layout**: Desktop, tablet, and mobile views with tailored tables, cards, and modals.
- **Consistent States**: Loading spinners, empty states, error alerts, and success confirmations.

### 2. Authentication & Role-Based Security
- **Authentication**: JWT access & refresh tokens via SimpleJWT + Django session authentication.
- **Roles**:
  - `Administrator`: Full system access, team invitation/management, role configuration, company settings, audit logs.
  - `Sales Manager`: Company-wide lead and client oversight, lead assignment, lead conversion, pipeline analysis.
  - `Salesperson`: Create and manage assigned leads and clients, convert eligible assigned leads.
  - `Developer`: Read-only access to clients and technical requirements.
  - `Video Editor`: Read-only access to deliverables and client creative specs.
- **Rate Limiting**: DRF throttling configured on sensitive authentication and password reset endpoints.
- **Account Control**: Admin toggle to activate or deactivate staff accounts. Deactivated accounts are immediately blocked from logging in.

### 3. Centralized Database Design
- **Authoritative `Client` Model**: Persistent sequential client ID format (e.g., `CLI-01001`), name, company, email, normalized email for deduplication, phone, website, billing address, service interests, client status, and assigned team member.
- **Persistent Relations**: Future quotations, invoices, projects, and calendar events link to this single Client model via `client_id`.
- **Duplicate Prevention**: Email normalization (`.strip().lower()`) ensures duplicates cannot be created accidentally.

### 4. Lead Management & "Convert to Client" Core Workflow
- **Lead Pipeline**: Statuses (*New, Contacted, Qualified, Proposal, Won, Lost*) with visual pipeline stages.
- **Prominent "Convert to Client" Workflow**:
  1. Displays confirmation modal with pre-filled lead data.
  2. Allows entering additional billing details and service interests.
  3. Checks for existing client duplicates using normalized email.
  4. If duplicate detected: returns HTTP 409 Conflict with option to link lead to existing client without creating a duplicate.
  5. If no duplicate: creates exactly one Client record in a single database transaction.
  6. Links original lead to the newly created client, marks status as `Won`, and preserves all original communication notes and activity history.
  7. **Idempotent**: Repeated clicks or retries return the existing linked client without creating duplicates.

### 5. Company Settings & Branding
- **Company Name**: Roo4Tech
- **Default Currency**: PKR (Pakistani Rupee) configured across pipeline budgets and metrics.
- **Logo Upload Validation**: Server-side and client-side validation ensuring file size ≤ 2 MB and formats (*PNG, JPG, JPEG, WEBP, SVG*).
- **Address**: Arfa Software Technology Park, Lahore, Pakistan.

### 6. Audit Trail
- Comprehensive audit logging recording authentication, lead creation, lead-to-client conversion, client updates, and role modifications. Passwords and access tokens are strictly excluded from logs.

---

## 🛠 Technology Stack

### Backend
- **Python**: 3.14
- **Django**: 5.2 (LTS)
- **Django REST Framework**: 3.18
- **SimpleJWT**: 5.5
- **Pillow**: 13.0 (Image processing & logo validation)
- **Database**: SQLite3 (Local dev/testing) & PostgreSQL (Production ready via `DATABASE_URL`)

### Frontend
- **Framework**: Next.js 16 (App Router)
- **Language**: TypeScript 5
- **UI & Styling**: React 19, Tailwind CSS 4, Lucide React Icons
- **HTTP Client**: Centralized API client with JWT storage and automatic bearer injection

---

## 📦 Directory Structure

```
Root4tech-CRM/
├── backend/
│   ├── apps/
│   │   ├── accounts/       # User model, roles, authentication, team management
│   │   ├── clients/        # Central Client model, notes, activities, documents
│   │   ├── leads/          # Lead model, qualification stages, conversion workflow
│   │   ├── company/        # CompanySettings, logo upload, AuditLog model
│   │   └── dashboard/      # Real database-driven stats and sales pipeline
│   ├── core/               # Django settings, URLs, WSGI
│   ├── venv/               # Python virtual environment
│   ├── manage.py
│   ├── requirements.txt
│   └── .env
└── frontend/
    ├── src/
    │   ├── app/            # App router pages (dashboard, leads, clients, team, reports, settings, login)
    │   ├── components/     # Layout (Sidebar, Header), UI (Badge, Button, Modal, StatCard)
    │   ├── context/        # AuthContext, CompanyContext
    │   ├── lib/            # Universal API client
    │   └── types/          # TypeScript interfaces (User, Lead, Client, Settings)
    ├── package.json
    └── next.config.ts
```

---

## 🔑 Default Seed Accounts & Credentials

The database comes pre-seeded with initial accounts for immediate testing:

| Role | Email | Password | Scope |
| :--- | :--- | :--- | :--- |
| **Administrator** | `admin@roo4tech.com` | `AdminPassword2026!` | Full access to team, settings, and all CRM records |
| **Sales Manager** | `salesmanager@roo4tech.com` | `SalesPassword2026!` | Company-wide lead/client assignment and pipeline analysis |
| **Salesperson** | `sales@roo4tech.com` | `SalesPassword2026!` | Create, manage, and convert assigned leads & clients |
| **Developer** | `dev@roo4tech.com` | `DevPassword2026!` | Read-only access to client and technical specifications |

---

## ⚙️ Environment Variables

### Backend (`backend/.env`)
```ini
SECRET_KEY=roo4tech-super-secure-crm-secret-key-change-in-production-2026!@#
DEBUG=True
ALLOWED_HOSTS=localhost,127.0.0.1
CORS_ALLOWED_ORIGINS=http://localhost:3000,http://127.0.0.1:3000
DATABASE_URL=
DEFAULT_CURRENCY=PKR
COMPANY_NAME=Roo4Tech
```

### Frontend (`frontend/.env.local` optional)
```ini
NEXT_PUBLIC_API_URL=http://localhost:8000/api
```

---

## 🏃 Running the Application

### 1. Backend Server
```bash
cd backend
venv\Scripts\activate
python manage.py migrate
python manage.py seed_crm       # Seeds initial accounts & baseline records
python manage.py runserver 8000
```
Backend API will be accessible at: `http://localhost:8000/api/`
Django Admin accessible at: `http://localhost:8000/admin/`

### 2. Frontend Development Server
```bash
cd frontend
npm run dev
```
Open your browser at: `http://localhost:3000`

---

## 🧪 Automated Test Suite & Acceptance Results

Run backend automated test suite:
```bash
cd backend
venv\Scripts\python.exe manage.py test apps
```

### Test Suite Execution Output:
```
Creating test database for alias 'default'...
........................
----------------------------------------------------------------------
Ran 24 tests in 2.023s

OK
Destroying test database for alias 'default'...
```

### Verified Acceptance Criteria:
1. **Authentication & Security**: Login, logout, JWT issuance, deactivated user blocking, password reset token generation and confirmation.
2. **Authorization**: Administrator vs Sales Manager vs Salesperson vs Developer access boundaries.
3. **Client CRUD**: Persistent unique ID generation (`CLI-01001`), name/company/email validation, duplicate prevention.
4. **Lead CRUD**: Status stages, priorities, budget in PKR, assigned salesperson.
5. **Lead to Client Conversion**:
   - Converting one lead creates exactly one client.
   - Repeating conversion is idempotent (returns existing client, never creates a duplicate).
   - Original lead links to client and status updates to `Won`.
   - Notes and activity timeline are preserved.
6. **Duplicate Client Detection**: Conversion endpoint detects existing matching client and returns HTTP 409 Conflict with option to link.
7. **Transaction Rollback**: Simulated database failure during conversion properly rolls back changes, leaving no orphaned clients.
8. **Logo Upload Validation**: Rejects files exceeding 2 MB and unsupported file extensions.
9. **Frontend Production Build**: `npm run build` succeeds with zero TypeScript errors and static generation.
