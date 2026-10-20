export type UserRole =
  | 'Administrator'
  | 'Sales Manager'
  | 'Salesperson'
  | 'Developer'
  | 'Video Editor';

export interface User {
  id: number;
  email: string;
  username: string;
  first_name: string;
  last_name: string;
  full_name: string;
  role: UserRole;
  phone: string;
  avatar: string | null;
  is_active: boolean;
  two_factor_enabled: boolean;
  created_at: string;
  updated_at: string;
}

export type LeadStatus = 'New' | 'Contacted' | 'Qualified' | 'Proposal' | 'Won' | 'Lost';
export type LeadPriority = 'Low' | 'Medium' | 'High' | 'Urgent';
export type LeadSource = 'Website' | 'Referral' | 'LinkedIn' | 'Cold Call' | 'Social Media' | 'Other';

export interface LeadNote {
  id: number;
  lead: number;
  author: number;
  author_details: User | null;
  content: string;
  created_at: string;
}

export interface LeadActivity {
  id: number;
  lead: number;
  user: number | null;
  user_details: User | null;
  action: string;
  description: string;
  created_at: string;
}

export interface Lead {
  id: number;
  lead_name: string;
  company: string;
  email: string;
  normalized_email?: string;
  phone: string;
  website: string;
  interested_service: string;
  estimated_budget: string | number | null;
  lead_source: LeadSource;
  status: LeadStatus;
  priority: LeadPriority;
  next_follow_up_date: string | null;
  notes: string;
  assigned_salesperson: number | null;
  assigned_salesperson_details: User | null;
  converted_client: number | null;
  converted_client_details?: Client | null;
  converted_at?: string | null;
  converted_by?: number | null;
  converted_by_details?: User | null;
  created_by?: number | null;
  created_by_details?: User | null;
  notes_list?: LeadNote[];
  activities_list?: LeadActivity[];
  created_at: string;
  updated_at: string;
}

export type ClientStatus = 'Active' | 'Inactive' | 'Lead_Converted' | 'Archived';

export interface ClientNote {
  id: number;
  client: number;
  author: number | null;
  author_details: User | null;
  content: string;
  created_at: string;
}

export interface ClientActivity {
  id: number;
  client: number;
  user: number | null;
  user_details: User | null;
  action_type: string;
  description: string;
  created_at: string;
}

export interface ClientDocument {
  id: number;
  client: number;
  uploaded_by: number | null;
  uploaded_by_details: User | null;
  title: string;
  file: string;
  file_url: string | null;
  file_size: number;
  created_at: string;
}

export interface ConvertedLeadBrief {
  id: number;
  lead_name: string;
  company: string;
  email: string;
  status: string;
  lead_source: string;
  estimated_budget: string | number;
  created_at: string;
  converted_at: string;
}

export interface Client {
  id: number;
  client_id: string;
  name: string;
  company_name: string;
  email: string;
  normalized_email?: string;
  phone: string;
  website: string;
  billing_address: string;
  service_interests: string;
  client_status: ClientStatus;
  notes: string;
  assigned_team_member: number | null;
  assigned_team_member_details: User | null;
  created_by?: number | null;
  created_by_details?: User | null;
  updated_by?: number | null;
  updated_by_details?: User | null;
  notes_list?: ClientNote[];
  activities_list?: ClientActivity[];
  documents_list?: ClientDocument[];
  converted_leads?: ConvertedLeadBrief[];
  linked_records?: {
    quotations: Array<{
      id: number;
      quotation_number: string;
      title: string;
      status: string;
      total_amount: string | number;
      currency: string;
      issue_date: string;
      is_converted_to_project: boolean;
      is_converted_to_invoice: boolean;
    }>;
    quotations_count: number;
    invoices: Array<{
      id: number;
      invoice_number: string;
      title: string;
      status: string;
      total_amount: string | number;
      amount_paid: string | number;
      remaining_balance: string | number;
      currency: string;
      issue_date: string;
      due_date: string | null;
    }>;
    invoices_count: number;
    payments: Array<{
      id: number;
      receipt_number: string;
      amount: string | number;
      currency: string;
      payment_date: string;
      payment_method: string;
      invoice_number?: string;
    }>;
    payments_count: number;
    projects: Array<{
      id: number;
      project_code: string;
      project_name: string;
      status: string;
      progress_percentage: number;
      budget: string | number;
      currency: string;
      due_date: string | null;
    }>;
    projects_count: number;
    calendar_events: Array<{
      id: number;
      title: string;
      event_type: string;
      status: string;
      start_time: string;
      location_or_link?: string;
    }>;
    calendar_events_count: number;
  };
  created_at: string;
  updated_at: string;
}

export interface CompanySettings {
  id: number;
  company_name: string;
  logo: string | null;
  logo_url: string | null;
  email: string;
  phone: string;
  website: string;
  address: string;
  default_currency: string;
  theme_preference: 'dark' | 'light' | 'system';
  updated_at: string;
  updated_by_details?: User | null;
}

export interface AuditLog {
  id: number;
  user: number | null;
  user_details: User | null;
  action: string;
  module: string;
  entity_id: string;
  description: string;
  ip_address: string | null;
  created_at: string;
}

export interface DashboardStats {
  leads: {
    total: number;
    new: number;
    contacted: number;
    qualified: number;
    proposal: number;
    won: number;
    lost: number;
  };
  clients: {
    total: number;
    active: number;
    converted: number;
    archived: number;
  };
  pipeline_summary: Array<{
    status: string;
    label: string;
    count: number;
    budget: number;
  }>;
  upcoming_follow_ups: Array<{
    id: number;
    lead_name: string;
    company: string;
    email: string;
    phone: string;
    status: string;
    priority: string;
    next_follow_up_date: string;
    assigned_to: string;
  }>;
  team_overview: {
    total: number;
    active: number;
    by_role: Record<string, number>;
  };
  recent_activities: AuditLog[];
  quotations?: {
    total: number;
    by_status: Record<string, number>;
  };
  invoices?: {
    total: number;
    by_status: Record<string, number>;
    financial_summary: Array<{
      currency: string;
      total_invoiced: number;
      total_paid: number;
      total_outstanding: number;
    }>;
    total_invoiced_pkr: number;
    total_paid_pkr: number;
    total_outstanding_pkr: number;
  };
  projects?: {
    total: number;
    active: number;
    by_status: Record<string, number>;
  };
  calendar?: {
    upcoming_meetings: number;
    overdue_follow_ups: number;
  };
  team_workload?: Array<{
    id: number;
    name: string;
    role: string;
    pending_tasks: number;
    active_projects: number;
  }>;
  phase2_ready: {
    quotations_count: number;
    invoices_count: number;
    active_projects: number;
    phase2_status: string;
  };
}

// --- Phase 2: Currency System ---
export type CurrencyCode = 'PKR' | 'USD' | 'GBP' | 'EUR' | 'AED' | 'SAR' | 'CAD';

export interface ExchangeRate {
  id: number;
  currency_code: CurrencyCode;
  rate_to_base: string | number;
  source: string;
  updated_at: string;
  updated_by?: number | null;
  updated_by_name?: string | null;
}

export interface CompanyService {
  id: number;
  name: string;
  category: string;
  description: string;
  default_unit_price: string | number;
  currency: string;
  billing_type: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

// --- Phase 2: Quotations & Proposals ---
export type QuotationStatus = 'Draft' | 'Sent' | 'Accepted' | 'Rejected' | 'Expired' | 'Cancelled';

export interface QuotationItem {
  id?: number;
  item_order: number;
  description: string;
  quantity: string | number;
  unit_price: string | number;
  line_total?: string | number;
}

export interface Quotation {
  id: number;
  quotation_number: string;
  title: string;
  client: number;
  client_details?: Client;
  related_lead?: number | null;
  salesperson?: number | null;
  salesperson_details?: User | null;
  status: QuotationStatus;
  issue_date: string;
  expiry_date?: string | null;
  currency: CurrencyCode;
  exchange_rate_to_base: string | number;
  exchange_rate_source?: string;
  exchange_rate_date?: string | null;
  subtotal: string | number;
  discount_percentage: string | number;
  discount_amount: string | number;
  tax_percentage: string | number;
  tax_amount: string | number;
  total_amount: string | number;
  terms_and_conditions: string;
  internal_notes: string;
  client_snapshot?: Record<string, unknown>;
  is_converted_to_project: boolean;
  converted_project_id?: number | null;
  is_converted_to_invoice: boolean;
  converted_invoice_id?: number | null;
  items: QuotationItem[];
  created_by?: number | null;
  created_by_details?: User | null;
  created_at: string;
  updated_at: string;
}

// --- Phase 2: Invoices & Payments ---
export type InvoiceStatus = 'Draft' | 'Issued' | 'Partially Paid' | 'Paid' | 'Overdue' | 'Cancelled';

export interface InvoiceItem {
  id?: number;
  item_order: number;
  description: string;
  quantity: string | number;
  unit_price: string | number;
  line_total?: string | number;
}

export interface Payment {
  id: number;
  receipt_number: string;
  invoice: number;
  invoice_number?: string;
  client: number;
  client_name?: string;
  client_id?: string;
  amount: string | number;
  currency: CurrencyCode;
  payment_date: string;
  payment_method: string;
  transaction_reference: string;
  notes: string;
  recorded_by?: number | null;
  recorded_by_name?: string | null;
  created_at: string;
}

export interface Invoice {
  id: number;
  invoice_number: string;
  title: string;
  client: number;
  client_details?: Client;
  quotation?: number | null;
  project?: number | null;
  status: InvoiceStatus;
  issue_date: string;
  due_date?: string | null;
  currency: CurrencyCode;
  exchange_rate_to_base: string | number;
  exchange_rate_source?: string;
  exchange_rate_date?: string | null;
  subtotal: string | number;
  discount_percentage: string | number;
  discount_amount: string | number;
  tax_percentage: string | number;
  tax_amount: string | number;
  total_amount: string | number;
  amount_paid: string | number;
  remaining_balance: string | number;
  terms_and_conditions: string;
  internal_notes: string;
  client_snapshot?: Record<string, unknown>;
  items: InvoiceItem[];
  payments: Payment[];
  created_by?: number | null;
  created_by_details?: User | null;
  created_at: string;
  updated_at: string;
}

// --- Phase 2: Projects & Tasks ---
export type ProjectStatus = 'Planning' | 'In Progress' | 'On Hold' | 'Completed' | 'Cancelled';

export interface ProjectMilestone {
  id: number;
  project: number;
  title: string;
  description: string;
  due_date?: string | null;
  deliverables: string;
  budget_allocated: string | number;
  is_completed: boolean;
  completed_at?: string | null;
  tasks_count?: number;
  created_at: string;
}

export interface TaskChecklistItem {
  id?: number;
  item_order: number;
  description: string;
  is_completed: boolean;
}

export interface TaskComment {
  id: number;
  task: number;
  author: number;
  author_details?: User | null;
  content: string;
  created_at: string;
}

export type TaskPriority = 'Low' | 'Medium' | 'High' | 'Urgent';
export type TaskStatus = 'To Do' | 'In Progress' | 'In Review' | 'Done' | 'Blocked';

export interface Task {
  id: number;
  project: number;
  project_code?: string;
  project_name?: string;
  milestone?: number | null;
  title: string;
  description: string;
  assigned_to?: number | null;
  assigned_to_details?: User | null;
  priority: TaskPriority;
  status: TaskStatus;
  deadline?: string | null;
  dependencies: string;
  checklists: TaskChecklistItem[];
  comments: TaskComment[];
  created_at: string;
  updated_at: string;
}

export interface ProjectActivity {
  id: number;
  project: number;
  user?: number | null;
  user_details?: User | null;
  action_type: string;
  description: string;
  created_at: string;
}

export interface Project {
  id: number;
  project_code: string;
  project_name: string;
  description?: string;
  client: number;
  client_details?: Client;
  quotation?: number | null;
  status: ProjectStatus;
  project_manager?: number | null;
  project_manager_details?: User | null;
  assigned_team_members?: number[];
  assigned_team_members_details?: User[];
  start_date: string;
  due_date?: string | null;
  completed_at?: string | null;
  budget: string | number;
  currency: string;
  progress_percentage: number;
  tasks_count?: number;
  completed_tasks_count?: number;
  milestones?: ProjectMilestone[];
  tasks?: Task[];
  activities?: ProjectActivity[];
  created_by?: number | null;
  created_at: string;
  updated_at: string;
}

// --- Phase 2: Calendar & Follow-ups ---
export type CalendarEventType =
  | 'Client Meeting'
  | 'Sales Call'
  | 'Demonstration'
  | 'Project Milestone'
  | 'Task Deadline'
  | 'Follow-up Reminder';

export type CalendarEventStatus = 'Pending' | 'Completed' | 'Overdue' | 'Cancelled';

export interface CalendarEvent {
  id: number;
  title: string;
  description: string;
  event_type: CalendarEventType;
  status: CalendarEventStatus;
  start_time: string;
  end_time?: string | null;
  client?: number | null;
  client_details?: Client | null;
  lead?: number | null;
  lead_details?: Lead | null;
  project?: number | null;
  project_code?: string;
  project_name?: string;
  assigned_to?: number | null;
  assigned_to_details?: User | null;
  location_or_link?: string;
  outcome_notes?: string;
  created_by?: number | null;
  created_at: string;
  updated_at: string;
}

// --- Phase 2: Realtime Notifications ---
export interface Notification {
  id: number;
  title: string;
  message: string;
  notification_type: string;
  link: string;
  is_read: boolean;
  created_at: string;
}

// --- Phase 2: Automated Workflows ---
export interface AutomationRule {
  id: number;
  rule_type: string;
  name: string;
  is_active: boolean;
  days_trigger: number;
  send_in_app: boolean;
  send_email: boolean;
  updated_at: string;
}

export interface AutomationLog {
  id: number;
  rule_type: string;
  entity_type: string;
  entity_id: string;
  dedup_key: string;
  status: string;
  message: string;
  executed_at: string;
}

// --- Phase 3: AI Assistant Types ---
export interface ChatMessage {
  id: string;
  conversation: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  metadata?: {
    tools_called?: string[];
    proposals?: string[];
    has_document_context?: boolean;
    provider?: string;
    model?: string;
    [key: string]: any;
  };
  created_at: string;
}

export interface Conversation {
  id: string;
  title: string;
  is_archived: boolean;
  message_count?: number;
  messages?: ChatMessage[];
  created_at: string;
  updated_at: string;
}

export interface ActionProposal {
  id: string;
  token: string;
  action_type: string;
  preview_data: {
    action_title?: string;
    summary?: string;
    warnings?: string[];
    [key: string]: any;
  };
  status: 'PENDING' | 'EXECUTED' | 'CANCELLED' | 'EXPIRED';
  execution_result?: any;
  created_at: string;
  expires_at: string;
}

export interface AssistantConfig {
  settings: {
    provider: string;
    model_name: string;
    temperature: number;
    max_tokens: number;
    is_enabled: boolean;
    allowed_roles: string;
  };
  is_configured: boolean;
  active_provider: string;
  active_model: string;
  supported_providers: string[];
}

