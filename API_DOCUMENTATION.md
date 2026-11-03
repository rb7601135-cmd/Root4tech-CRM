# Roo4Tech Smart CRM — Comprehensive API Architecture & Integration Guide

This document provides an exhaustive, end-to-end reference for all APIs in the **Roo4Tech Smart CRM** ecosystem. It explains where each API connects, how it functions under the hood, request/response models, connected frontend components, and external third-party integrations.

---

## Table of Contents
1. [Architecture Overview & Connection Flow](#1-architecture-overview--connection-flow)
2. [Frontend Connection Layer (`frontend/src/lib/api.ts`)](#2-frontend-connection-layer)
3. [Authentication, Security & Session Lifecycle](#3-authentication-security--session-lifecycle)
4. [Complete API Endpoint Directory by Module](#4-complete-api-endpoint-directory-by-module)
   - [4.1 Authentication & Team (`apps.accounts`)](#41-authentication--team-accounts)
   - [4.2 Leads Management (`apps.leads`)](#42-leads-management-leads)
   - [4.3 Clients Management (`apps.clients`)](#43-clients-management-clients)
   - [4.4 Quotations & Proposals (`apps.quotations`)](#44-quotations--proposals-quotations)
   - [4.5 Invoices & Payments (`apps.invoices`)](#45-invoices--payments-invoices)
   - [4.6 Projects & Tasks (`apps.projects`)](#46-projects--tasks-projects)
   - [4.7 Calendar & Follow-ups (`apps.calendar_events`)](#47-calendar--follow-ups-calendar_events)
   - [4.8 Company Settings, Exchange Rates & Services (`apps.company`)](#48-company-settings-exchange-rates--services-company)
   - [4.9 Dashboard & Financial Analytics (`apps.dashboard`)](#49-dashboard--financial-analytics-dashboard)
   - [4.10 Realtime Notifications (`apps.realtime`)](#410-realtime-notifications-realtime)
   - [4.11 Automation Engine (`apps.automation`)](#411-automation-engine-automation)
   - [4.12 AI Assistant & Action Proposals (`apps.assistant`)](#412-ai-assistant--action-proposals-assistant)
   - [4.13 Health & Diagnostics (`apps.company.health_check`)](#413-health--diagnostics-health)
5. [AI Assistant Internal Tool Calling Ecosystem](#5-ai-assistant-internal-tool-calling-ecosystem)
6. [External Third-Party APIs & Cloud Services](#6-external-third-party-apis--cloud-services)
7. [API Error Handling & Status Code Standards](#7-api-error-handling--status-code-standards)

---

## 1. Architecture Overview & Connection Flow

The system operates as a decoupled modern full-stack application:
- **Frontend**: Next.js 15 (TypeScript, TailwindCSS, App Router) running on `http://localhost:3000`.
- **Backend API**: Django 5.x + Django REST Framework (DRF) running on `http://127.0.0.1:8000`.
- **Database**: PostgreSQL on Supabase (production) or local SQLite (`db.sqlite3` in development).
- **Communication Protocol**: JSON over HTTP/HTTPS with JWT Bearer Token Authentication, plus Server-Sent Events (SSE) for streaming AI chat and binary HTTP streaming for ReportLab-generated PDFs.

```mermaid
flowchart TD
    subgraph Browser ["Next.js Client (Port 3000)"]
        UI["UI Pages / Components\n(/leads, /invoices, /assistant...)"]
        Client["ApiClient Singleton\n(frontend/src/lib/api.ts)"]
        TokenStore["Local Storage\n(roo4tech_access_token)"]
        UI --> Client
        Client <--> TokenStore
    end

    subgraph Backend ["Django REST Framework (Port 8000)"]
        JWTAuth["JWT Authentication & Permissions\n(SimpleJWT & Role Guards)"]
        Router["URL Routing Engine\n(backend/core/urls.py)"]
        ViewSets["ViewSets & Controllers\n(Leads, Invoices, Quotations, AI...)"]
        AuditEngine["Audit Log & Activity Engine"]
        AutoEngine["Automation Engine"]
        
        Client -->|HTTP + Bearer Token| JWTAuth
        JWTAuth --> Router
        Router --> ViewSets
        ViewSets --> AuditEngine
        ViewSets --> AutoEngine
    end

    subgraph Data ["Data Storage & Third-Party APIs"]
        DB[("PostgreSQL (Supabase) / SQLite")]
        OpenAI["OpenAI API (GPT-4o-mini)"]
        Gemini["Google Gemini 3.5 Flash"]
        SMTP["SMTP Email Server (Gmail/Host)"]
        ReportLab["ReportLab PDF Engine (In-Memory)"]
        
        ViewSets --> DB
        ViewSets --> OpenAI
        ViewSets --> Gemini
        ViewSets --> SMTP
        ViewSets --> ReportLab
    end
```

---

## 2. Frontend Connection Layer

All communication from the Next.js frontend originates from the centralized API client in [frontend/src/lib/api.ts](file:///e:/Root4tech-CRM/frontend/src/lib/api.ts).

### Key Features of the Connection Layer:
1. **Base URL Resolution**:
   Uses `process.env.NEXT_PUBLIC_API_URL` (default: `http://127.0.0.1:8000/api`).
2. **Automatic Authorization Injection**:
   Every outgoing request checks `localStorage.getItem('roo4tech_access_token')` and appends `Authorization: Bearer <token>`.
3. **Request Deduplication**:
   Concurrent identical `GET` requests share an active in-flight Promise to avoid duplicate network calls.
4. **Fallback Mechanism**:
   If connecting to `127.0.0.1:8000` fails with a network error, it automatically falls back to `localhost:8000` before throwing an actionable error.
5. **Unauthorized Handling**:
   Upon receiving `401 Unauthorized`, it clears stored tokens and redirects the user to `/login`.
6. **Streaming Reader**:
   `streamAssistantMessage()` parses Server-Sent Events (`data: {...}`) line-by-line using a `TextDecoder` and `ReadableStreamDefaultReader`.

---

## 3. Authentication, Security & Session Lifecycle

The API uses **JSON Web Tokens (SimpleJWT)** with strict role-based access control (RBAC):
- **User Roles**: `Administrator`, `Sales Manager`, `Salesperson`, `Accountant`, `Support`.
- **Token Format**:
  - `access`: Short-lived token passed in HTTP `Authorization: Bearer <token>`.
  - `refresh`: Long-lived token stored in `localStorage` (`roo4tech_refresh_token`) to renew the session via `/api/auth/token/refresh/`.
- **Query Parameter Auth for PDFs**:
  When opening PDFs in new tabs or iframe downloads, browsers cannot set custom headers. Endpoints `/api/quotations/<id>/pdf/`, `/api/invoices/<id>/pdf/`, and `/api/payments/<id>/receipt_pdf/` support a fallback `?token=<jwt_token>` query parameter validated by DRF's `JWTAuthentication`.

---

## 4. Complete API Endpoint Directory by Module

### 4.1 Authentication & Team (`apps.accounts`)
**Base URL:** `/api/auth/` and `/api/team/`  
**Frontend Hook:** `api.login()`, `api.getCurrentUser()`, `api.getTeam()`, etc.

| Method | Endpoint | Description | Request Body / Params | Response |
| :--- | :--- | :--- | :--- | :--- |
| `POST` | `/api/auth/login/` | Authenticates user credentials, generates JWT access/refresh tokens, records audit log. | `{"email": "...", "password": "..."}` | `{"access": "...", "refresh": "...", "user": {...}}` |
| `POST` | `/api/auth/logout/` | Blacklists refresh token and clears active session. | None / optional refresh token | `{"message": "Logged out successfully"}` |
| `POST` | `/api/auth/token/refresh/` | Exchanges a valid refresh token for a fresh access token. | `{"refresh": "..."}` | `{"access": "..."}` |
| `GET` | `/api/auth/me/` | Retrieves the authenticated user's profile and permissions. | Header: `Authorization: Bearer <token>` | User object (name, email, role, phone, etc.) |
| `PATCH`| `/api/auth/me/` | Updates personal profile information (name, phone, title). | `{"first_name": "...", "phone": "..."}` | Updated User object |
| `POST` | `/api/auth/change-password/` | Updates user password after verifying current password. | `{"old_password": "...", "new_password": "..."}` | `{"message": "Password changed successfully"}` |
| `POST` | `/api/auth/password-reset/` | Requests a password reset link sent via SMTP email. | `{"email": "user@roo4tech.com"}` | `{"message": "Reset instructions sent if email exists"}` |
| `POST` | `/api/auth/password-reset/confirm/` | Validates one-time reset token and updates password. | `{"token": "...", "new_password": "..."}` | `{"message": "Password has been reset"}` |
| `GET` | `/api/team/` | Lists team members. Admin/Manager see all; others see active colleagues. | Query: `?search=...&role=...` | `{"results": [User]}` |
| `POST` | `/api/team/` | Creates a new employee user account (Admin only). | `{"email": "...", "password": "...", "role": "..."}` | Created User object |
| `PATCH`| `/api/team/<id>/` | Modifies member role, department, contact info (Admin only). | Partial user fields | Updated User object |
| `POST` | `/api/team/<id>/toggle_active/` | Activates or deactivates a user's account access (Admin only). | None | `{"message": "...", "user": {...}}` |

---

### 4.2 Leads Management (`apps.leads`)
**Base URL:** `/api/leads/`  
**Frontend Hook:** [frontend/src/app/leads/page.tsx](file:///e:/Root4tech-CRM/frontend/src/app/leads/page.tsx) via `api.getLeads()`, `api.convertLead()`, etc.

| Method | Endpoint | Description | Request Body / Params | Response |
| :--- | :--- | :--- | :--- | :--- |
| `GET` | `/api/leads/` | Lists leads with pagination, search, status/priority filters. | `?search=...&status=New&assigned_salesperson=...` | `{"count": N, "results": [Lead]}` |
| `POST` | `/api/leads/` | Creates a new sales lead. Triggers duplicate detection checks. | `{"lead_name": "...", "email": "...", "source": "..."}` | Created Lead object |
| `GET` | `/api/leads/<id>/` | Retrieves lead profile, interaction history, and notes. | Path: lead ID | Full Lead object |
| `PATCH`| `/api/leads/<id>/` | Updates pipeline stage, estimated value, next follow-up date. | `{"status": "Qualified", "estimated_value": 50000}` | Updated Lead object |
| `DELETE`| `/api/leads/<id>/` | Removes a lead (Admin/Manager only). | Path: lead ID | `204 No Content` |
| `POST` | `/api/leads/<id>/add_note/` | Appends a timestamped note/call log to the lead timeline. | `{"content": "Client agreed on demo call next Tuesday"}` | `{"message": "Note added", "lead": {...}}` |
| `GET` | `/api/leads/check_duplicate/`| Real-time validation to warn if email/phone exists. | `?email=john@example.com&phone=...` | `{"duplicate_lead": true/false, "duplicate_client": ...}` |
| `POST` | `/api/leads/<id>/convert/` | **Converts lead into Client**. Generates `CLI-XXXXX`, moves notes, marks lead `Won`. Can link to existing client. | `{"billing_address": "...", "service_interests": "..."}` | `{"message": "Lead converted", "client": Client}` |

---

### 4.3 Clients Management (`apps.clients`)
**Base URL:** `/api/clients/`  
**Frontend Hook:** [frontend/src/app/clients/page.tsx](file:///e:/Root4tech-CRM/frontend/src/app/clients/page.tsx) via `api.getClients()`, `api.archiveClient()`, etc.

| Method | Endpoint | Description | Request Body / Params | Response |
| :--- | :--- | :--- | :--- | :--- |
| `GET` | `/api/clients/` | Lists clients with pagination, status (Active/Archived), search. | `?search=Acme&client_status=Active` | `{"count": N, "results": [Client]}` |
| `POST` | `/api/clients/` | Registers new client, automatically assigning `CLI-XXXXX`. | `{"name": "...", "company_name": "...", "email": "..."}` | Created Client object |
| `GET` | `/api/clients/<id>/` | 360-degree client view: contacts, notes, quotations, invoices, projects. | Path: client ID or code | Comprehensive Client profile |
| `PATCH`| `/api/clients/<id>/` | Modifies contact details, currency preference, tax ID. | Partial client fields | Updated Client object |
| `DELETE`| `/api/clients/<id>/` | Soft-deletes or purges client record. | Path: client ID | `204 No Content` |
| `POST` | `/api/clients/<id>/archive/`| Toggles archive status (`Active` <-> `Archived`). | None | `{"message": "Client status updated", "client": {...}}` |
| `POST` | `/api/clients/<id>/add_note/`| Logs meeting minutes, interaction notes, or client requests. | `{"content": "Quarterly review completed"}` | `{"message": "Note added", "client": {...}}` |
| `GET` | `/api/clients/check_duplicate/`| Checks if client name, email or phone is already registered. | `?email=...&name=...` | `{"duplicate": true/false, "client": {...}}` |

---

### 4.4 Quotations & Proposals (`apps.quotations`)
**Base URL:** `/api/quotations/`  
**Frontend Hook:** [frontend/src/app/quotations/page.tsx](file:///e:/Root4tech-CRM/frontend/src/app/quotations/page.tsx) via `api.getQuotations()`, `api.sendQuotation()`, etc.

| Method | Endpoint | Description | Request Body / Params | Response |
| :--- | :--- | :--- | :--- | :--- |
| `GET` | `/api/quotations/` | Lists quotations with multi-currency totals and status filters. | `?status=Sent&currency=PKR` | `{"count": N, "results": [Quotation]}` |
| `POST` | `/api/quotations/` | Creates formal quotation with line items, tax, discount, expiry. | `{"client": 1, "items": [...], "currency": "PKR"}` | Created Quotation object |
| `GET` | `/api/quotations/<id>/`| Retrieves full quotation details including line items. | Path: quotation ID | Full Quotation object |
| `PATCH`| `/api/quotations/<id>/`| Modifies items or terms. If already issued, records audit amendment. | Partial quotation fields | Updated Quotation object |
| `DELETE`| `/api/quotations/<id>/`| Deletes draft quotation. | Path: quotation ID | `204 No Content` |
| `POST` | `/api/quotations/<id>/issue/` | Locks quotation into `Issued` status and freezes client snapshot. | None | `{"status": "Issued", ...}` |
| `POST` | `/api/quotations/<id>/accept/`| Marks quotation as `Accepted` by client. | None | `{"status": "Accepted", ...}` |
| `GET` | `/api/quotations/<id>/pdf/` | **Generates dynamic branded PDF** with company logo and items table. | `?token=...&download=1` | Binary `application/pdf` stream |
| `POST` | `/api/quotations/<id>/send/` | Sends quotation to client email via SMTP with attached PDF. | `{"recipient_email": "...", "message": "..."}` | `{"message": "Quotation sent successfully"}` |
| `POST` | `/api/quotations/<id>/convert_to_project/`| Converts accepted quote into active **Project** with milestones. | None | `{"project_id": 12, "project_code": "PRJ-..."}` |
| `POST` | `/api/quotations/<id>/convert_to_invoice/`| Converts accepted quote into **Tax Invoice** copying line items. | None | `{"invoice_id": 45, "invoice_number": "INV-..."}` |

---

### 4.5 Invoices & Payments (`apps.invoices`)
**Base URL:** `/api/invoices/` and `/api/payments/`  
**Frontend Hook:** [frontend/src/app/invoices/page.tsx](file:///e:/Root4tech-CRM/frontend/src/app/invoices/page.tsx) via `api.getInvoices()`, `api.recordPayment()`, etc.

| Method | Endpoint | Description | Request Body / Params | Response |
| :--- | :--- | :--- | :--- | :--- |
| `GET` | `/api/invoices/` | Lists invoices with remaining balance, overdue flags, and search. | `?status=Issued&overdue=true` | `{"count": N, "results": [Invoice]}` |
| `POST` | `/api/invoices/` | Creates invoice with auto-generated `INV-XXXXX` identifier. | `{"client": 1, "items": [...], "due_date": "..."}` | Created Invoice object |
| `GET` | `/api/invoices/<id>/` | Retrieves invoice breakdown, line items, and payment ledger. | Path: invoice ID | Full Invoice object |
| `PATCH`| `/api/invoices/<id>/` | Updates invoice details. Records audit amendment if issued. | Partial invoice fields | Updated Invoice object |
| `DELETE`| `/api/invoices/<id>/` | Removes invoice record if not finalized. | Path: invoice ID | `204 No Content` |
| `POST` | `/api/invoices/<id>/issue/` | Finalizes draft invoice and freezes client details snapshot. | None | Updated Invoice object |
| `POST` | `/api/invoices/<id>/send/` | Dispatches invoice to client via SMTP email with attached PDF. | `{"recipient_email": "...", "subject": "..."}` | `{"message": "Invoice sent successfully"}` |
| `GET` | `/api/invoices/<id>/pdf/` | **Generates vector PDF Invoice** with QR/Banking info. | `?token=...&download=1` | Binary `application/pdf` stream |
| `POST` | `/api/invoices/<id>/record_payment/` | **Records payment**, calculates new remaining balance, updates status (`Partially Paid` / `Paid`), logs audit entry. | `{"amount": 25000, "payment_method": "Bank Transfer", "transaction_reference": "TXN998"}` | `{"message": "Payment recorded", "payment": Payment, "invoice": Invoice}` |
| `GET` | `/api/payments/` | Lists chronological payment transactions across all clients. | `?invoice=...&client=...` | `{"count": N, "results": [Payment]}` |
| `GET` | `/api/payments/<id>/receipt_pdf/` | Generates official PDF Payment Receipt for client accounting. | `?token=...` | Binary `application/pdf` stream |

---

### 4.6 Projects & Tasks (`apps.projects`)
**Base URL:** `/api/projects/` and `/api/tasks/`  
**Frontend Hook:** [frontend/src/app/projects/page.tsx](file:///e:/Root4tech-CRM/frontend/src/app/projects/page.tsx) via `api.getProjects()`, `api.createTask()`, etc.

| Method | Endpoint | Description | Request Body / Params | Response |
| :--- | :--- | :--- | :--- | :--- |
| `GET` | `/api/projects/` | Lists delivery projects with completion %, deadlines, budget. | `?status=In Progress&client=...` | `{"count": N, "results": [Project]}` |
| `POST` | `/api/projects/` | Initializes new client project with budget and milestones. | `{"title": "...", "client": 1, "budget": 150000}` | Created Project object |
| `GET` | `/api/projects/<id>/` | Retrieves project details, milestones, task progress breakdown. | Path: project ID | Full Project profile |
| `PATCH`| `/api/projects/<id>/` | Updates milestone statuses, completion percentage, managers. | Partial project fields | Updated Project object |
| `DELETE`| `/api/projects/<id>/` | Deletes project. | Path: project ID | `204 No Content` |
| `POST` | `/api/projects/<id>/add_milestone/`| Adds deliverable milestone with target deadline. | `{"title": "Beta Deployment", "due_date": "..."}` | Updated Project with milestones |
| `GET` | `/api/tasks/` | Lists tasks filtered by project, assignee, priority, status. | `?project=...&assigned_to=...&status=Todo` | `{"count": N, "results": [Task]}` |
| `POST` | `/api/tasks/` | Creates a task assigned to a team member with checklist items. | `{"title": "API Docs", "project": 2, "due_date": "..."}` | Created Task object |
| `PATCH`| `/api/tasks/<id>/` | Updates task status (`Todo`, `In Progress`, `Review`, `Done`). | Partial task fields | Updated Task object |
| `DELETE`| `/api/tasks/<id>/` | Deletes task. | Path: task ID | `204 No Content` |
| `POST` | `/api/tasks/<id>/add_comment/` | Posts discussion update to task activity feed. | `{"content": "PR is ready for review"}` | `{"message": "Comment added"}` |
| `POST` | `/api/tasks/<id>/toggle_checklist/`| Checks or unchecks sub-task checklist item. | `{"item_id": 4}` | `{"id": 4, "is_completed": true/false}` |

---

### 4.7 Calendar & Follow-ups (`apps.calendar_events`)
**Base URL:** `/api/calendar-events/`  
**Frontend Hook:** [frontend/src/app/calendar/page.tsx](file:///e:/Root4tech-CRM/frontend/src/app/calendar/page.tsx) via `api.getCalendarEvents()`, etc.

| Method | Endpoint | Description | Request Body / Params | Response |
| :--- | :--- | :--- | :--- | :--- |
| `GET` | `/api/calendar-events/` | Fetches events, follow-ups, calls, milestones by date range. | `?start_date=...&end_date=...&event_type=Meeting` | `{"results": [CalendarEvent]}` |
| `POST` | `/api/calendar-events/` | Schedules meeting or client follow-up reminder. | `{"title": "...", "start_time": "...", "client": 1}` | Created CalendarEvent object |
| `PATCH`| `/api/calendar-events/<id>/` | Reschedules meeting date/time or updates attendees. | Partial event fields | Updated CalendarEvent object |
| `DELETE`| `/api/calendar-events/<id>/` | Cancels scheduled event. | Path: event ID | `204 No Content` |
| `POST` | `/api/calendar-events/<id>/complete/`| Marks event completed and stores meeting notes/outcome. | `{"outcome_notes": "Contract signed on call"}` | Updated CalendarEvent object |

---

### 4.8 Company Settings, Exchange Rates & Services (`apps.company`)
**Base URL:** `/api/company/`  
**Frontend Hook:** [frontend/src/app/settings/page.tsx](file:///e:/Root4tech-CRM/frontend/src/app/settings/page.tsx) and [frontend/src/app/services/page.tsx](file:///e:/Root4tech-CRM/frontend/src/app/services/page.tsx)

| Method | Endpoint | Description | Request Body / Params | Response |
| :--- | :--- | :--- | :--- | :--- |
| `GET` | `/api/company/settings/` | Returns company branding, logo URL, currency, terms, tax #. | None | CompanySettings singleton |
| `PATCH`| `/api/company/settings/` | Modifies company details or uploads logo (`multipart/form-data`). | Form data / JSON (Admin only) | Updated settings |
| `GET` | `/api/company/audit-logs/` | Comprehensive security and data modification audit trail. | `?module=INVOICES&action=...` | `{"results": [AuditLog]}` |
| `GET` | `/api/company/exchange-rates/`| Returns exchange rates relative to base currency (PKR). | None | List of currencies (USD, EUR, GBP, AED, SAR, CAD) |
| `PATCH`| `/api/company/exchange-rates/<id>/`| Updates conversion rate for foreign currency (Admin/Manager). | `{"rate_to_base": 278.50}` | Updated ExchangeRate |
| `GET` | `/api/company/services/` | Standard product & service price catalog. | `?category=Development&active_only=true` | `{"results": [CompanyService]}` |
| `POST` | `/api/company/services/` | Adds service item with default rate to catalog (Admin/Manager). | `{"name": "...", "default_unit_price": 50000}` | Created Service object |
| `PATCH`| `/api/company/services/<id>/` | Modifies catalog service rate, unit description, or active status. | Partial service fields | Updated Service object |
| `DELETE`| `/api/company/services/<id>/` | Retires service from catalog. | Path: service ID | `204 No Content` |

---

### 4.9 Dashboard & Financial Analytics (`apps.dashboard`)
**Base URL:** `/api/dashboard/stats/`  
**Frontend Hook:** [frontend/src/app/dashboard/page.tsx](file:///e:/Root4tech-CRM/frontend/src/app/dashboard/page.tsx) via `api.getDashboardStats()`

| Method | Endpoint | Description | Response Data Structure |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/dashboard/stats/` | Aggregates real-time business KPIs, pipeline metrics, and multi-currency financial summaries across all modules. | Returns: <br>• Lead counts by status (`New`, `Qualified`, `Won`, etc.)<br>• Client counts (`Active`, `Converted`, `Archived`)<br>• Quotation pipeline numbers<br>• Invoice financials (`total_invoiced`, `total_paid`, `total_outstanding`) converted to PKR base currency<br>• Active projects and progress<br>• Upcoming meetings & overdue follow-ups<br>• Recent audit log activities |

---

### 4.10 Realtime Notifications (`apps.realtime`)
**Base URL:** `/api/realtime/notifications/`  
**Frontend Hook:** Navigation bar and notification dropdown via `api.getNotifications()`, `api.markNotificationRead()`, etc.

| Method | Endpoint | Description | Request Body / Params | Response |
| :--- | :--- | :--- | :--- | :--- |
| `GET` | `/api/realtime/notifications/` | Fetches active notifications for current user. | None | `{"results": [Notification]}` |
| `GET` | `/api/realtime/notifications/unread_count/` | Lightweight counter for badge icon in UI header. | None | `{"unread_count": 4}` |
| `POST` | `/api/realtime/notifications/<id>/read/` | Marks specific notification as read. | Path: notification ID | `{"status": "marked_read"}` |
| `POST` | `/api/realtime/notifications/mark_all_read/`| Clears unread badge across all user notifications. | None | `{"status": "all_marked_read"}` |

---

### 4.11 Automation Engine (`apps.automation`)
**Base URL:** `/api/automation/`  
**Frontend Hook:** Automation settings page via `api.getAutomationRules()`, `api.runAutomations()`, etc.

| Method | Endpoint | Description | Request Body / Params | Response |
| :--- | :--- | :--- | :--- | :--- |
| `GET` | `/api/automation/rules/` | Lists workflow automation rules (lead reminders, quote expiry, invoice overdues). | None | `{"results": [AutomationRule]}` |
| `PATCH`| `/api/automation/rules/<id>/` | Configures trigger threshold days or activates/deactivates rule. | `{"days_trigger": 3, "is_active": true}` | Updated rule |
| `GET` | `/api/automation/logs/` | Audit log of automated actions executed to ensure deduplication. | None | `{"results": [AutomationLog]}` |
| `POST` | `/api/automation/run/` | **Triggers full automation cycle**. Checks follow-ups, expires quotes, flags overdue invoices, dispatches alerts. | None | `{"message": "Automations executed", "results": {"lead_follow_ups": 2, ...}}` |

---

### 4.12 AI Assistant & Action Proposals (`apps.assistant`)
**Base URL:** `/api/assistant/`  
**Frontend Hook:** [frontend/src/app/assistant/page.tsx](file:///e:/Root4tech-CRM/frontend/src/app/assistant/page.tsx) via `api.streamAssistantMessage()`, `api.executeActionProposal()`, etc.

| Method | Endpoint | Description | Request Body / Params | Response |
| :--- | :--- | :--- | :--- | :--- |
| `GET` | `/api/assistant/conversations/` | Lists user's private AI chat history sessions. | `?search=...&archived=false` | `{"results": [Conversation]}` |
| `POST` | `/api/assistant/conversations/` | Starts a new AI conversation thread. | `{"title": "Client Review"}` | Created Conversation |
| `PATCH`| `/api/assistant/conversations/<id>/`| Renames or archives a conversation session. | `{"title": "New Title"}` | Updated Conversation |
| `DELETE`| `/api/assistant/conversations/<id>/`| Deletes a conversation and its messages. | Path: conversation ID | `204 No Content` |
| `POST` | `/api/assistant/conversations/<id>/messages/stream/` | **Core AI Chat Endpoint**. Streams responses via Server-Sent Events (SSE). Connects to OpenAI/Gemini with CRM tool calling. | `{"message": "What invoices are overdue?", "document_context": "..."}` | `text/event-stream` yielding SSE chunks (`tool_call`, `proposal`, `content`, `done`) |
| `POST` | `/api/assistant/actions/execute/` | **Two-Phase Action Confirmation**. Executes consequential action (create lead, task, quote) after human approval. | `{"action_token": "...", "confirm": true/false}` | `{"success": true, "result": {...}}` |
| `POST` | `/api/assistant/documents/upload/` | Uploads PDF/DOCX/TXT file, extracts text, and returns token for conversation context. | `multipart/form-data` with `file` | `{"filename": "...", "extracted_text": "...", "char_count": 1420}` |
| `GET` | `/api/assistant/config/` | Retrieves assistant parameters (temperature, model name, active status). | None | AssistantConfig object |
| `PATCH`| `/api/assistant/config/` | Updates assistant parameters (Admin only). | `{"model_name": "gpt-4o-mini", "temperature": 0.4}` | Updated config |

---

### 4.13 Health & Diagnostics (`apps.company.health_check`)
**Base URL:** `/api/health/`

| Method | Endpoint | Description | Response |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/health/` | Production readiness probe. Executes a database cursor query to test DB connectivity. | `{"status": "healthy", "service": "Root4Tech Smart CRM API", "version": "3.0.0", "database": "healthy"}` |

---

## 5. AI Assistant Internal Tool Calling Ecosystem

When the user asks questions or issues commands in the AI Assistant chat (`/api/assistant/conversations/<id>/messages/stream/`), the backend LLM engine does not fabricate data. Instead, it uses **OpenAI-compatible Function Calling** to query the CRM database directly or prepare two-phase action proposals.

The allowlisted tools defined in [backend/apps/assistant/tools/crm_tools.py](file:///e:/Root4tech-CRM/backend/apps/assistant/tools/crm_tools.py) include:

### 1. Data Retrieval Tools (Read-Only)
- **`crm_search_clients(query, limit)`**: Queries clients table by name, company, email, or client ID (`CLI-XXXXX`).
- **`crm_get_client_details(client_id)`**: Pulls full 360° summary including financials, quotation history, invoices, and assigned manager.
- **`crm_search_leads(query, status, priority, limit)`**: Filters leads pipeline with stage criteria.
- **`crm_get_lead_details(lead_id)`**: Retrieves detailed lead history and follow-up schedules.
- **`crm_get_overdue_invoices()`**: Fetches all unpaid invoices past their due date with outstanding balances in PKR.
- **`crm_get_sales_metrics(period)`**: Calculates verified revenue, won deals, and month-over-month growth.
- **`crm_get_delayed_projects()`**: Flags projects with overdue milestones or lagging completion.
- **`crm_get_team_workload()`**: Summarizes active tasks and project assignments per team member.
- **`crm_get_calendar_events(days_ahead)`**: Lists upcoming client calls and follow-ups.

### 2. Consequential Action Proposal Tools (Human-In-The-Loop)
To prevent unauthorized AI hallucinations from modifying the database, write operations use a **Two-Phase Action Proposal**:
1. The AI calls a proposal tool (e.g., `crm_propose_create_lead`).
2. The backend generates a cryptographically signed `ActionProposal` with a 15-minute expiration token.
3. The frontend displays an interactive preview card with **[Confirm]** and **[Cancel]** buttons.
4. Only when the user clicks Confirm does `/api/assistant/actions/execute/` execute the actual database change.

Available proposal tools:
- **`crm_propose_create_lead(...)`**
- **`crm_propose_convert_lead(...)`**
- **`crm_propose_create_task(...)`**
- **`crm_propose_schedule_event(...)`**
- **`crm_propose_draft_quotation(...)`**

---

## 6. External Third-Party APIs & Cloud Services

The CRM connects to several external and cloud-hosted services:

```mermaid
graph LR
    CRM["Roo4Tech CRM Backend"]
    
    CRM -->|1. LLM Chat & Tools| OpenAI["OpenAI API\n(api.openai.com/v1/chat/completions)"]
    CRM -->|2. Gemini Alternative| GoogleAI["Google Gemini API\n(generativelanguage.googleapis.com)"]
    CRM -->|3. PostgreSQL Engine| Supabase["Supabase Cloud Database\n(db.xmqgvfkaawesyvvyqovq.supabase.co)"]
    CRM -->|4. Email Notifications| SMTP["SMTP Relay\n(smtp.gmail.com:587)"]
```

### 1. OpenAI API (`https://api.openai.com/v1/chat/completions`)
- **Key**: `OPENAI_API_KEY` in `backend/.env`.
- **Default Model**: `gpt-4o-mini` (or `gpt-4o`).
- **Function**: Processes assistant user queries, executes CRM function calls with structured JSON arguments, and streams responses back to the frontend.

### 2. Google Gemini API (`https://generativelanguage.googleapis.com/v1beta/openai/chat/completions`)
- **Key**: `GEMINI_API_KEY` in `backend/.env`.
- **Default Model**: `gemini-3.5-flash` with automatic fallback to `gemini-3.5-flash-lite` if the upstream Google API experiences high traffic load (HTTP 503/429).
- **Function**: Fully drop-in alternative to OpenAI using OpenAI-compatible endpoint format.

### 3. Supabase Managed PostgreSQL
- **Key**: `DATABASE_URL` in `backend/.env`.
- **Protocol**: Direct SSL connection (`postgresql://postgres:...@db....supabase.co:5432/postgres?sslmode=require`) or Transaction Pooler on port 6543.
- **Function**: Persists all CRM relational entities, audit logs, and user sessions.

### 4. SMTP Email Delivery (Gmail / Custom Relay)
- **Settings**: `EMAIL_HOST`, `EMAIL_PORT`, `EMAIL_HOST_USER`, `EMAIL_HOST_PASSWORD`.
- **Function**:
  - Sends branded PDF Quotations to clients.
  - Sends PDF Invoices with payment instructions.
  - Sends password reset links.

### 5. ReportLab PDF Generation Engine
- **Engine**: Local Python ReportLab library (`apps.quotations.pdf` & `apps.invoices.pdf`).
- **Function**: Renders dynamic, vector-sharp PDFs containing company logos, tax numbers, items tables, and bank details without external cloud rendering costs.

---

## 7. API Error Handling & Status Code Standards

All APIs follow consistent RESTful HTTP status code semantics:

| HTTP Status | Meaning | Typical Trigger |
| :--- | :--- | :--- |
| `200 OK` | Request succeeded | Successful GET, PATCH, or action execution |
| `201 Created` | Entity created | Successful POST creating a client, quote, lead, or payment |
| `204 No Content` | Entity removed | Successful DELETE request |
| `400 Bad Request` | Validation failure | Missing required fields, overpaying invoice balance, duplicate email |
| `401 Unauthorized` | Missing / invalid JWT | Expired token; triggers automatic frontend redirect to `/login` |
| `403 Forbidden` | Insufficient permissions | Non-admin attempting to delete users or alter exchange rates |
| `404 Not Found` | Entity not found | Querying non-existent `client_id` or invoice |
| `500 Server Error` | Unhandled backend exception | Check Django server logs |
| `503 Service Unavailable` | Degraded service | Health check failure when database connection is unreachable |

All error responses return a standardized JSON structure:
```json
{
  "detail": "Descriptive error message for the user",
  "error": "Optional error code or string"
}
```
If validation errors occur on multiple serializer fields, DRF returns a dictionary of field errors:
```json
{
  "email": ["Enter a valid email address."],
  "amount": ["Payment amount must be greater than zero."]
}
```
The frontend `ApiClient` automatically extracts these into human-readable alerts.

---

*Documentation maintained by the Roo4Tech CRM Engineering Team.*

