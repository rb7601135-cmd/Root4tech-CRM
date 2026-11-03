# Root4Tech Smart CRM - Node.js Backend

A production-ready Node.js, Express, and Prisma backend for **Root4Tech Smart CRM**, engineered to deploy seamlessly on **Vercel Serverless** while preserving 100% compatibility with the existing Next.js 16 frontend (`frontend/`) and the Supabase PostgreSQL database.

---

## 🚀 Key Highlights & Architectural Decisions

1. **Zero Frontend Modifications Required:**
   All DRF (Django REST Framework) routes, query parameters, payload structures, and response shapes have been precisely preserved.
   All endpoints are dual-mounted on both `/api/...` and `/...` so that whether the frontend requests `/api/leads/` or `/leads/`, both resolve cleanly.

2. **Django PBKDF2 Password Compatibility (CRITICAL):**
   Existing users with Django `pbkdf2_sha256$iterations$salt$hash` passwords can log in seamlessly without resetting their passwords. The authentication handler verifies PBKDF2 SHA256 hashes using Node's native `crypto.pbkdf2Sync` before falling back to bcrypt.

3. **Supabase PostgreSQL via Prisma ORM:**
   The database schema is mapped directly to the existing Django database tables (`accounts_user`, `clients_client`, `quotations_quotation`, etc.) using `@map` and `@@map`. No migrations are run that would alter or drop existing production data.

4. **Multi-Currency & PKR Base Conversion:**
   Full financial integrity with PKR as the base currency. Supports USD, GBP, EUR, AED, SAR, and CAD conversions based on dynamic exchange rates.

5. **In-Memory PDF Generation:**
   Native `pdfkit` PDF generation for quotations, invoices, and payment receipts without filesystem dependency, making it 100% compatible with Vercel's read-only serverless environment.

---

## 🛠 Local Development Setup

### Prerequisites
- Node.js >= 20.0.0
- npm >= 10.0.0

### Step 1: Install Dependencies
```bash
cd backend-node
npm install
```

### Step 2: Configure Environment Variables
Create a `.env` file inside `backend-node/`:
```bash
cp .env.example .env
```
Ensure your `DATABASE_URL` points to your Supabase PostgreSQL database:
```env
DATABASE_URL="postgresql://postgres.[REF]:[PASSWORD]@aws-0-[REGION].pooler.supabase.com:6543/postgres?pgbouncer=true"
JWT_SECRET="roo4tech-super-secure-production-jwt-secret-key-2026-xyz"
CORS_ORIGIN="https://root4tech-crm-frontend.vercel.app,http://localhost:3000,http://127.0.0.1:3000"
PORT=8000
```

### Step 3: Generate Prisma Client
```bash
npm run prisma:generate
```

### Step 4: Run Locally in Dev Mode
```bash
npm run dev
```
The server will start at `http://localhost:8000`.

---

## 🌐 Deploying to Vercel

### Step 1: Import Repository to Vercel
1. Go to [Vercel Dashboard](https://vercel.com/dashboard) and click **"Add New Project"**.
2. Select your repository: `https://github.com/rb7601135-cmd/Root4tech-CRM`.
3. In **Project Settings**:
   - **Root Directory**: `backend-node`
   - **Framework Preset**: `Other`
   - **Build Command**: `npm run build` (or `prisma generate && tsc`)
   - **Output Directory**: Leave empty / default

### Step 2: Configure Vercel Environment Variables
Add the following in **Settings > Environment Variables**:

| Variable Name | Description | Example / Recommended Value |
|---|---|---|
| `DATABASE_URL` | Supabase Postgres Session Pooler string | `postgresql://postgres.[REF]:[PASS]@aws-0-[REGION].pooler.supabase.com:6543/postgres?pgbouncer=true` |
| `JWT_SECRET` | 64+ char secret key for signing JWT tokens | `your-secure-jwt-secret-key-32-chars-minimum` |
| `CORS_ORIGIN` | Allowed origins for Next.js frontend | `https://root4tech-crm-frontend.vercel.app,http://localhost:3000` |
| `DEFAULT_CURRENCY` | Base CRM currency | `PKR` |
| `COMPANY_NAME` | Business name | `Roo4Tech` |
| `GROQ_API_KEY` | (Optional) Groq AI API key for assistant | `gsk_...` |
| `OPENAI_API_KEY` | (Optional) OpenAI key for assistant | `sk-...` |

### Step 3: Deploy & Link with Frontend
Once deployed, copy your backend URL (e.g. `https://root4tech-crm-backend-node.vercel.app`).
In your frontend Vercel project (`root4tech-crm-frontend`), set:
```env
NEXT_PUBLIC_API_URL="https://root4tech-crm-backend-node.vercel.app/api"
```

---

## 🔑 How to Test Login with Existing Admin Account

You can verify authentication using `curl`, Postman, or the frontend:

```bash
curl -X POST http://localhost:8000/api/auth/login/ \
  -H "Content-Type: application/json" \
  -d '{
    "username": "admin@roo4tech.com",
    "password": "<YOUR_ADMIN_PASSWORD>"
  }'
```

### Expected Response:
```json
{
  "access": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refresh": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": 1,
    "email": "admin@roo4tech.com",
    "username": "admin",
    "first_name": "Admin",
    "last_name": "User",
    "role": "Administrator",
    "is_active": true,
    "two_factor_enabled": false
  }
}
```

---

## 📋 Comprehensive Endpoint Reference

### 1. Health & Status
- `GET /api/health/` — System and database health status

### 2. Authentication & Profile (`/api/auth/`)
- `POST /api/auth/login/` — Login with username/email & PBKDF2/bcrypt verification
- `POST /api/auth/logout/` — Logout
- `POST /api/auth/token/refresh/` — Refresh access token using refresh JWT
- `GET /api/auth/me/` — Current logged-in user profile
- `POST /api/auth/change-password/` — Authenticated password update
- `POST /api/auth/password-reset/` — Request password reset email
- `POST /api/auth/password-reset/confirm/` — Confirm password reset token

### 3. Team Management (`/api/team/`)
- `GET /api/team/` — List all team members
- `POST /api/team/` — Invite / create new team member (Admin only)
- `PATCH /api/team/:id/` — Update team member role/details (Admin only)
- `POST /api/team/:id/toggle_active/` — Activate/deactivate team member (Admin only)

### 4. Clients (`/api/clients/`)
- `GET /api/clients/` — List clients (with search, status filter, pagination)
- `POST /api/clients/` — Create new client
- `GET /api/clients/:id/` — Retrieve client details
- `PATCH /api/clients/:id/` — Update client
- `DELETE /api/clients/:id/` — Soft-archive or remove client
- `POST /api/clients/:id/archive/` — Archive client
- `POST /api/clients/:id/add_note/` — Add client note
- `GET /api/clients/check_duplicate/` — Pre-check duplicate email/phone

### 5. Leads (`/api/leads/`)
- `GET /api/leads/` — List leads (with status filter, search, pagination)
- `POST /api/leads/` — Create new lead
- `GET /api/leads/:id/` — Retrieve lead details
- `PATCH /api/leads/:id/` — Update lead
- `DELETE /api/leads/:id/` — Delete lead
- `POST /api/leads/:id/convert/` — Convert lead into client with duplicate check
- `POST /api/leads/:id/add_note/` — Add note to lead
- `GET /api/leads/check_duplicate/` — Check email duplicate for lead

### 6. Quotations (`/api/quotations/`)
- `GET /api/quotations/` — List quotations
- `POST /api/quotations/` — Create quotation with line items
- `GET /api/quotations/:id/` — Retrieve quotation with items
- `PATCH /api/quotations/:id/` — Update quotation
- `DELETE /api/quotations/:id/` — Delete quotation
- `POST /api/quotations/:id/issue/` — Mark quotation as Issued
- `POST /api/quotations/:id/accept/` — Mark quotation as Accepted
- `POST /api/quotations/:id/send/` — Mark quotation as Sent
- `GET /api/quotations/:id/pdf/` — In-memory PDF stream
- `POST /api/quotations/:id/convert_to_project/` — Generate project from quotation
- `POST /api/quotations/:id/convert_to_invoice/` — Generate invoice from quotation

### 7. Invoices & Payments (`/api/invoices/`, `/api/payments/`)
- `GET /api/invoices/` — List invoices
- `POST /api/invoices/` — Create invoice with line items
- `GET /api/invoices/:id/` — Retrieve invoice with items
- `PATCH /api/invoices/:id/` — Update invoice
- `DELETE /api/invoices/:id/` — Delete invoice
- `POST /api/invoices/:id/issue/` — Mark invoice as Issued
- `POST /api/invoices/:id/send/` — Mark invoice as Sent
- `GET /api/invoices/:id/pdf/` — In-memory PDF stream
- `POST /api/invoices/:id/record_payment/` — Record payment against invoice
- `GET /api/payments/` — List all recorded payments
- `GET /api/payments/:id/receipt_pdf/` — Download official payment receipt PDF

### 8. Projects & Tasks (`/api/projects/`, `/api/tasks/`)
- `GET /api/projects/` — List projects
- `POST /api/projects/` — Create project
- `GET /api/projects/:id/` — Retrieve project with milestones and tasks
- `PATCH /api/projects/:id/` — Update project
- `DELETE /api/projects/:id/` — Delete project
- `POST /api/projects/:id/add_milestone/` — Add milestone to project
- `GET /api/tasks/` — List tasks (filtered by project or assigned user)
- `POST /api/tasks/` — Create task
- `PATCH /api/tasks/:id/` — Update task status / priority
- `DELETE /api/tasks/:id/` — Delete task
- `POST /api/tasks/:id/add_comment/` — Add comment to task
- `POST /api/tasks/:id/toggle_checklist/` — Toggle checklist item completion

### 9. Dashboard (`/api/dashboard/`)
- `GET /api/dashboard/stats/` — Aggregated metrics:
  - Lead conversion rate and pipeline stage distribution
  - Client count by status
  - Quotation pipeline totals
  - Invoiced revenue, amount paid, and overdue balances in PKR
  - Project completion and task breakdown
  - Upcoming calendar meetings
  - Recent audit logs

### 10. Company Settings & Catalog (`/api/company/`)
- `GET /api/company/settings/` — Retrieve company name, email, address, logo, currency
- `PATCH /api/company/settings/` — Update company settings (Admin only)
- `GET /api/company/exchange-rates/` — Real-time exchange rate table
- `PATCH /api/company/exchange-rates/:id/` — Update exchange rate
- `GET /api/company/services/` — Service catalog list
- `POST /api/company/services/` — Create new service offering
- `PATCH /api/company/services/:id/` — Update service offering
- `DELETE /api/company/services/:id/` — Remove service from catalog
- `GET /api/company/audit-logs/` — Immutable audit log feed

### 11. Calendar & Scheduling (`/api/calendar-events/`)
- `GET /api/calendar-events/` — List upcoming calendar events and meetings
- `POST /api/calendar-events/` — Create calendar event
- `PATCH /api/calendar-events/:id/` — Update calendar event
- `DELETE /api/calendar-events/:id/` — Delete calendar event
- `POST /api/calendar-events/:id/complete/` — Mark event as Completed with outcome notes

### 12. Realtime Notifications (`/api/realtime/`)
- `GET /api/realtime/notifications/` — List user notifications
- `POST /api/realtime/notifications/:id/read/` — Mark notification as read
- `POST /api/realtime/notifications/mark_all_read/` — Mark all notifications as read
- `GET /api/realtime/notifications/unread_count/` — Unread count badge

### 13. Automation Engine (`/api/automation/`)
- `GET /api/automation/rules/` — List automation triggers (follow-up, invoice due, quotation expiry)
- `PATCH /api/automation/rules/:id/` — Update trigger days and delivery channels
- `GET /api/automation/logs/` — Review execution logs
- `POST /api/automation/run/` — Execute CRM automation rules cycle

### 14. AI Assistant (`/api/assistant/`)
- `GET /api/assistant/conversations/` — List user conversation threads
- `POST /api/assistant/conversations/` — Create conversation thread
- `GET /api/assistant/conversations/:id/` — Retrieve conversation with messages
- `PATCH /api/assistant/conversations/:id/` — Update conversation title or archive status
- `DELETE /api/assistant/conversations/:id/` — Delete conversation thread
- `POST /api/assistant/conversations/:id/messages/stream/` — SSE streaming AI chat endpoint
- `POST /api/assistant/actions/execute/` — Two-phase proposal confirmation endpoint
- `POST /api/assistant/documents/upload/` — Document parser (TXT, CSV, PDF) for untrusted context
- `GET /api/assistant/config/` — Assistant model configuration
- `PATCH /api/assistant/config/` — Update assistant model parameters (Admin only)

