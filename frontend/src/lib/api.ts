import {
  User,
  Lead,
  Client,
  CompanySettings,
  AuditLog,
  DashboardStats,
  Quotation,
  Invoice,
  Payment,
  Project,
  Task,
  CalendarEvent,
  ExchangeRate,
  Notification,
  AutomationRule,
  AutomationLog,
  CompanyService,
  Conversation,
  ChatMessage,
  ActionProposal,
  AssistantConfig,
} from '@/types/crm';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000/api';

class ApiClient {
  private token: string | null = null;
  private inFlightRequests: Map<string, Promise<any>> = new Map();

  constructor() {
    if (typeof window !== 'undefined') {
      this.token = localStorage.getItem('roo4tech_access_token');
    }
  }

  setToken(token: string | null) {
    this.token = token;
    if (typeof window !== 'undefined') {
      if (token) {
        localStorage.setItem('roo4tech_access_token', token);
      } else {
        localStorage.removeItem('roo4tech_access_token');
        localStorage.removeItem('roo4tech_refresh_token');
      }
    }
  }

  getToken(): string | null {
    if (!this.token && typeof window !== 'undefined') {
      this.token = localStorage.getItem('roo4tech_access_token');
    }
    return this.token;
  }

  async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const isGet = !options.method || options.method.toUpperCase() === 'GET';
    const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
    const dedupeKey = isGet ? `${cleanEndpoint}:${this.getToken() || ''}` : '';

    if (isGet && dedupeKey && this.inFlightRequests.has(dedupeKey)) {
      return this.inFlightRequests.get(dedupeKey) as Promise<T>;
    }

    const promise = this._executeRequest<T>(cleanEndpoint, options);

    if (isGet && dedupeKey) {
      this.inFlightRequests.set(dedupeKey, promise);
      promise.finally(() => {
        this.inFlightRequests.delete(dedupeKey);
      });
    }

    return promise;
  }

  private async _executeRequest<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const primaryUrl = `${API_BASE_URL}${endpoint}`;
    const headers: Record<string, string> = {
      ...(options.headers as Record<string, string>),
    };

    const token = this.getToken();
    if (token && !headers['Authorization']) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    if (!(options.body instanceof FormData) && !headers['Content-Type']) {
      headers['Content-Type'] = 'application/json';
    }

    let response: Response;
    try {
      response = await fetch(primaryUrl, {
        ...options,
        headers,
      });
    } catch (networkErr: unknown) {
      // If fetching 127.0.0.1 failed, try localhost as fallback
      if (primaryUrl.includes('127.0.0.1:8000')) {
        try {
          const fallbackUrl = primaryUrl.replace('127.0.0.1:8000', 'localhost:8000');
          response = await fetch(fallbackUrl, { ...options, headers });
        } catch {
          throw new Error(
            'Unable to connect to Roo4Tech CRM backend. Please make sure the Django backend server is running on port 8000 (double-click start_backend.bat or start_crm.bat).'
          );
        }
      } else {
        throw new Error(
          'Unable to connect to Roo4Tech CRM backend. Please make sure the Django backend server is running on port 8000 (double-click start_backend.bat or start_crm.bat).'
        );
      }
    }

    if (response.status === 401) {
      // Clear token if unauthorized
      if (typeof window !== 'undefined' && !endpoint.includes('/auth/login/')) {
        this.setToken(null);
        if (window.location.pathname !== '/login') {
          window.location.href = '/login';
        }
      }
    }

    if (response.status === 204) {
      return {} as T;
    }

    const contentType = response.headers.get('content-type') || '';
    let data: Record<string, unknown> | null = null;

    if (contentType.includes('application/json')) {
      try {
        data = await response.json();
      } catch {
        const rawText = await response.text().catch(() => '');
        data = { detail: rawText || `Server returned HTTP ${response.status}` };
      }
    } else {
      const rawText = await response.text().catch(() => '');
      if (rawText.trim().startsWith('<!DOCTYPE') || rawText.trim().startsWith('<html') || rawText.includes('<body')) {
        throw new Error(
          `The server returned an HTML error page (${response.status} ${response.statusText}) instead of JSON for '${endpoint}'. Please check that the Django backend server is running on http://127.0.0.1:8000.`
        );
      }
      try {
        data = JSON.parse(rawText);
      } catch {
        data = { detail: rawText || `Server returned HTTP ${response.status} ${response.statusText}` };
      }
    }

    if (!response.ok) {
      const errorMsg =
        (data?.detail as string) ||
        (data?.error as string) ||
        (data?.message as string) ||
        (typeof data === 'object' && data !== null ? Object.values(data).flat().join(' ') : 'An error occurred');
      const err = new Error(errorMsg) as Error & { status: number; data: unknown };
      err.status = response.status;
      err.data = data;
      throw err;
    }

    return data as T;
  }

  // --- Auth & Team ---
  async login(credentials: { email: string; password: string }) {
    const res = await this.request<{ access: string; refresh: string; user: User }>('/auth/login/', {
      method: 'POST',
      body: JSON.stringify(credentials),
    });
    this.setToken(res.access);
    if (typeof window !== 'undefined' && res.refresh) {
      localStorage.setItem('roo4tech_refresh_token', res.refresh);
    }
    return res;
  }

  async logout() {
    try {
      await this.request('/auth/logout/', { method: 'POST' });
    } catch {
      // Ignore network errors on logout
    } finally {
      this.setToken(null);
    }
  }

  async getCurrentUser(): Promise<User> {
    return this.request<User>('/auth/me/');
  }

  async updateProfile(data: Partial<User>): Promise<User> {
    return this.request<User>('/auth/me/', {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  async changePassword(data: { old_password: string; new_password: string }) {
    return this.request<{ message: string }>('/auth/change-password/', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async requestPasswordReset(email: string) {
    return this.request<{ message: string; token?: string }>('/auth/password-reset/', {
      method: 'POST',
      body: JSON.stringify({ email }),
    });
  }

  async confirmPasswordReset(data: { token: string; new_password: string }) {
    return this.request<{ message: string }>('/auth/password-reset/confirm/', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async getTeam(params?: Record<string, string | number | boolean>): Promise<{ results: User[] } | User[]> {
    const qs = params ? `?${new URLSearchParams(params as Record<string, string>).toString()}` : '';
    return this.request(`/team/${qs}`);
  }

  async createTeamMember(data: Partial<User> & { password?: string }): Promise<User> {
    return this.request<User>('/team/', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateTeamMember(id: number, data: Partial<User>): Promise<User> {
    return this.request<User>(`/team/${id}/`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  async toggleTeamActive(id: number): Promise<{ message: string; user: User }> {
    return this.request(`/team/${id}/toggle_active/`, {
      method: 'POST',
    });
  }

  // --- Leads ---
  async getLeads(params?: Record<string, string | number | boolean>): Promise<{ results: Lead[]; count: number } | Lead[]> {
    const qs = params ? `?${new URLSearchParams(params as Record<string, string>).toString()}` : '';
    return this.request(`/leads/${qs}`);
  }

  async getLead(id: number): Promise<Lead> {
    return this.request<Lead>(`/leads/${id}/`);
  }

  async createLead(data: Partial<Lead>): Promise<Lead> {
    return this.request<Lead>('/leads/', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateLead(id: number, data: Partial<Lead>): Promise<Lead> {
    return this.request<Lead>(`/leads/${id}/`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  async deleteLead(id: number) {
    return this.request(`/leads/${id}/`, { method: 'DELETE' });
  }

  async addLeadNote(id: number, content: string) {
    return this.request(`/leads/${id}/add_note/`, {
      method: 'POST',
      body: JSON.stringify({ content }),
    });
  }

  async checkLeadDuplicate(email: string, exclude_id?: number) {
    const qs = new URLSearchParams({ email, ...(exclude_id ? { exclude_id: String(exclude_id) } : {}) }).toString();
    return this.request<{ duplicate_lead: boolean; duplicate_client: boolean; lead?: Lead; client?: Client }>(`/leads/check_duplicate/?${qs}`);
  }

  async convertLead(
    id: number,
    data: {
      billing_address?: string;
      website?: string;
      service_interests?: string;
      link_existing_client_id?: string;
      confirm_link?: boolean;
    }
  ): Promise<{ message: string; client: Client; conflict?: boolean; duplicate_client?: Client }> {
    return this.request(`/leads/${id}/convert/`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  // --- Clients ---
  async getClients(params?: Record<string, string | number | boolean>): Promise<{ results: Client[]; count: number } | Client[]> {
    const qs = params ? `?${new URLSearchParams(params as Record<string, string>).toString()}` : '';
    return this.request(`/clients/${qs}`);
  }

  async getClient(id: number | string): Promise<Client> {
    return this.request<Client>(`/clients/${id}/`);
  }

  async createClient(data: Partial<Client>): Promise<Client> {
    return this.request<Client>('/clients/', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateClient(id: number | string, data: Partial<Client>): Promise<Client> {
    return this.request<Client>(`/clients/${id}/`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  async deleteClient(id: number | string) {
    return this.request(`/clients/${id}/`, { method: 'DELETE' });
  }

  async archiveClient(id: number | string) {
    return this.request(`/clients/${id}/archive/`, { method: 'POST' });
  }

  async addClientNote(id: number | string, content: string) {
    return this.request(`/clients/${id}/add_note/`, {
      method: 'POST',
      body: JSON.stringify({ content }),
    });
  }

  async checkClientDuplicate(email: string, exclude_id?: number) {
    const qs = new URLSearchParams({ email, ...(exclude_id ? { exclude_id: String(exclude_id) } : {}) }).toString();
    return this.request<{ duplicate: boolean; client?: Client }>(`/clients/check_duplicate/?${qs}`);
  }

  // --- Company Settings & Audit Logs ---
  async getCompanySettings(): Promise<CompanySettings> {
    return this.request<CompanySettings>('/company/settings/');
  }

  async updateCompanySettings(data: FormData | Partial<CompanySettings>): Promise<CompanySettings> {
    return this.request<CompanySettings>('/company/settings/', {
      method: 'PATCH',
      body: data instanceof FormData ? data : JSON.stringify(data),
    });
  }

  async getAuditLogs(params?: Record<string, string | number | boolean>): Promise<{ results: AuditLog[]; count: number } | AuditLog[]> {
    const qs = params ? `?${new URLSearchParams(params as Record<string, string>).toString()}` : '';
    return this.request(`/company/audit-logs/${qs}`);
  }

  // --- Dashboard ---
  async getDashboardStats(): Promise<DashboardStats> {
    return this.request<DashboardStats>('/dashboard/stats/');
  }

  // --- Phase 2: Quotations ---
  async getQuotations(params?: Record<string, string | number | boolean>): Promise<{ results: Quotation[]; count: number } | Quotation[]> {
    const qs = params ? `?${new URLSearchParams(params as Record<string, string>).toString()}` : '';
    return this.request(`/quotations/${qs}`);
  }

  async getQuotation(id: number | string): Promise<Quotation> {
    return this.request<Quotation>(`/quotations/${id}/`);
  }

  async createQuotation(data: Partial<Quotation>): Promise<Quotation> {
    return this.request<Quotation>('/quotations/', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateQuotation(id: number | string, data: Partial<Quotation>): Promise<Quotation> {
    return this.request<Quotation>(`/quotations/${id}/`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  async deleteQuotation(id: number | string) {
    return this.request(`/quotations/${id}/`, { method: 'DELETE' });
  }

  async issueQuotation(id: number | string): Promise<Quotation> {
    return this.request<Quotation>(`/quotations/${id}/issue/`, { method: 'POST' });
  }

  async acceptQuotation(id: number | string): Promise<Quotation> {
    return this.request<Quotation>(`/quotations/${id}/accept/`, { method: 'POST' });
  }

  async convertQuotationToProject(id: number | string): Promise<{ message: string; project_id: number; project_code: string; quotation: Quotation }> {
    return this.request(`/quotations/${id}/convert_to_project/`, { method: 'POST' });
  }

  async convertQuotationToInvoice(id: number | string): Promise<{ message: string; invoice_id: number; invoice_number: string; quotation: Quotation }> {
    return this.request(`/quotations/${id}/convert_to_invoice/`, { method: 'POST' });
  }

  getQuotationPdfUrl(id: number | string, download = false): string {
    const token = this.getToken();
    const params = new URLSearchParams();
    if (token) params.set('token', token);
    if (download) params.set('download', '1');
    const qs = params.toString();
    return `${API_BASE_URL}/quotations/${id}/pdf/${qs ? `?${qs}` : ''}`;
  }

  async sendQuotation(id: number | string, data?: { recipient_email?: string; subject?: string; message?: string }): Promise<{ message: string; quotation: Quotation }> {
    return this.request(`/quotations/${id}/send/`, {
      method: 'POST',
      body: JSON.stringify(data || {}),
    });
  }

  // --- Phase 2: Invoices & Payments ---
  async getInvoices(params?: Record<string, string | number | boolean>): Promise<{ results: Invoice[]; count: number } | Invoice[]> {
    const qs = params ? `?${new URLSearchParams(params as Record<string, string>).toString()}` : '';
    return this.request(`/invoices/${qs}`);
  }

  async getInvoice(id: number | string): Promise<Invoice> {
    return this.request<Invoice>(`/invoices/${id}/`);
  }

  async createInvoice(data: Partial<Invoice>): Promise<Invoice> {
    return this.request<Invoice>('/invoices/', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateInvoice(id: number | string, data: Partial<Invoice>): Promise<Invoice> {
    return this.request<Invoice>(`/invoices/${id}/`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  async deleteInvoice(id: number | string) {
    return this.request(`/invoices/${id}/`, { method: 'DELETE' });
  }

  async issueInvoice(id: number | string): Promise<Invoice> {
    return this.request<Invoice>(`/invoices/${id}/issue/`, { method: 'POST' });
  }

  async recordPayment(invoiceId: number | string, data: { amount: string | number; payment_method: string; payment_date?: string; transaction_reference?: string; notes?: string }) {
    return this.request<{ message: string; payment: Payment; invoice: Invoice }>(`/invoices/${invoiceId}/record_payment/`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  getInvoicePdfUrl(id: number | string, download = false): string {
    const token = this.getToken();
    const params = new URLSearchParams();
    if (token) params.set('token', token);
    if (download) params.set('download', '1');
    const qs = params.toString();
    return `${API_BASE_URL}/invoices/${id}/pdf/${qs ? `?${qs}` : ''}`;
  }

  async sendInvoice(id: number | string, data?: { recipient_email?: string; subject?: string; message?: string }): Promise<{ message: string; invoice: Invoice }> {
    return this.request(`/invoices/${id}/send/`, {
      method: 'POST',
      body: JSON.stringify(data || {}),
    });
  }

  async getPayments(params?: Record<string, string | number | boolean>): Promise<{ results: Payment[]; count: number } | Payment[]> {
    const qs = params ? `?${new URLSearchParams(params as Record<string, string>).toString()}` : '';
    return this.request(`/payments/${qs}`);
  }

  getReceiptPdfUrl(paymentId: number | string): string {
    const token = this.getToken();
    return `${API_BASE_URL}/payments/${paymentId}/receipt_pdf/${token ? `?token=${encodeURIComponent(token)}` : ''}`;
  }

  // --- Phase 2: Projects & Tasks ---
  async getProjects(params?: Record<string, string | number | boolean>): Promise<{ results: Project[]; count: number } | Project[]> {
    const qs = params ? `?${new URLSearchParams(params as Record<string, string>).toString()}` : '';
    return this.request(`/projects/${qs}`);
  }

  async getProject(id: number | string): Promise<Project> {
    return this.request<Project>(`/projects/${id}/`);
  }

  async createProject(data: Partial<Project>): Promise<Project> {
    return this.request<Project>('/projects/', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateProject(id: number | string, data: Partial<Project>): Promise<Project> {
    return this.request<Project>(`/projects/${id}/`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  async deleteProject(id: number | string) {
    return this.request(`/projects/${id}/`, { method: 'DELETE' });
  }

  async addProjectMilestone(projectId: number | string, data: Record<string, unknown>) {
    return this.request(`/projects/${projectId}/add_milestone/`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async getTasks(params?: Record<string, string | number | boolean>): Promise<{ results: Task[]; count: number } | Task[]> {
    const qs = params ? `?${new URLSearchParams(params as Record<string, string>).toString()}` : '';
    return this.request(`/tasks/${qs}`);
  }

  async createTask(data: Partial<Task>): Promise<Task> {
    return this.request<Task>('/tasks/', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateTask(id: number | string, data: Partial<Task>): Promise<Task> {
    return this.request<Task>(`/tasks/${id}/`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  async deleteTask(id: number | string) {
    return this.request(`/tasks/${id}/`, { method: 'DELETE' });
  }

  async addTaskComment(taskId: number | string, content: string) {
    return this.request(`/tasks/${taskId}/add_comment/`, {
      method: 'POST',
      body: JSON.stringify({ content }),
    });
  }

  async toggleTaskChecklist(taskId: number | string, itemId: number) {
    return this.request<{ id: number; is_completed: boolean }>(`/tasks/${taskId}/toggle_checklist/`, {
      method: 'POST',
      body: JSON.stringify({ item_id: itemId }),
    });
  }

  // --- Phase 2: Calendar & Follow-ups ---
  async getCalendarEvents(params?: Record<string, string | number | boolean>): Promise<{ results: CalendarEvent[]; count: number } | CalendarEvent[]> {
    const qs = params ? `?${new URLSearchParams(params as Record<string, string>).toString()}` : '';
    return this.request(`/calendar-events/${qs}`);
  }

  async createCalendarEvent(data: Partial<CalendarEvent>): Promise<CalendarEvent> {
    return this.request<CalendarEvent>('/calendar-events/', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateCalendarEvent(id: number | string, data: Partial<CalendarEvent>): Promise<CalendarEvent> {
    return this.request<CalendarEvent>(`/calendar-events/${id}/`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  async deleteCalendarEvent(id: number | string) {
    return this.request(`/calendar-events/${id}/`, { method: 'DELETE' });
  }

  async completeCalendarEvent(id: number | string, outcomeNotes?: string): Promise<CalendarEvent> {
    return this.request<CalendarEvent>(`/calendar-events/${id}/complete/`, {
      method: 'POST',
      body: JSON.stringify({ outcome_notes: outcomeNotes || '' }),
    });
  }

  // --- Phase 2: Currency & Exchange Rates ---
  async getExchangeRates(): Promise<{ results: ExchangeRate[] } | ExchangeRate[]> {
    return this.request('/company/exchange-rates/');
  }

  async updateExchangeRate(id: number, data: Partial<ExchangeRate>): Promise<ExchangeRate> {
    return this.request<ExchangeRate>(`/company/exchange-rates/${id}/`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  // --- Phase 2: Realtime Notifications ---
  async getNotifications(): Promise<{ results: Notification[]; count: number } | Notification[]> {
    return this.request('/realtime/notifications/');
  }

  async markNotificationRead(id: number) {
    return this.request(`/realtime/notifications/${id}/read/`, { method: 'POST' });
  }

  async markAllNotificationsRead() {
    return this.request('/realtime/notifications/mark_all_read/', { method: 'POST' });
  }

  async getUnreadNotificationsCount(): Promise<{ unread_count: number }> {
    return this.request('/realtime/notifications/unread_count/');
  }

  // --- Phase 2: Automated Workflows ---
  async getAutomationRules(): Promise<{ results: AutomationRule[] } | AutomationRule[]> {
    return this.request('/automation/rules/');
  }

  async updateAutomationRule(id: number, data: Partial<AutomationRule>): Promise<AutomationRule> {
    return this.request<AutomationRule>(`/automation/rules/${id}/`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  async getAutomationLogs(): Promise<{ results: AutomationLog[]; count: number } | AutomationLog[]> {
    return this.request('/automation/logs/');
  }

  async runAutomations(): Promise<{ message: string; results: Record<string, number> }> {
    return this.request('/automation/run/', { method: 'POST' });
  }

  // --- Company Services Catalog ---
  async getServices(params?: Record<string, string | number | boolean>): Promise<{ results: CompanyService[] } | CompanyService[]> {
    const qs = params ? `?${new URLSearchParams(params as Record<string, string>).toString()}` : '';
    return this.request(`/company/services/${qs}`);
  }

  async getService(id: number | string): Promise<CompanyService> {
    return this.request<CompanyService>(`/company/services/${id}/`);
  }

  async createService(data: Partial<CompanyService>): Promise<CompanyService> {
    return this.request<CompanyService>('/company/services/', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateService(id: number | string, data: Partial<CompanyService>): Promise<CompanyService> {
    return this.request<CompanyService>(`/company/services/${id}/`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  async deleteService(id: number | string): Promise<void> {
    return this.request(`/company/services/${id}/`, { method: 'DELETE' });
  }

  // --- Phase 3: AI Assistant ---
  async getConversations(params?: { search?: string; archived?: boolean }): Promise<{ results: Conversation[] } | Conversation[]> {
    const qs = params ? `?${new URLSearchParams(params as Record<string, string>).toString()}` : '';
    return this.request(`/assistant/conversations/${qs}`);
  }

  async createConversation(title?: string): Promise<Conversation> {
    return this.request<Conversation>('/assistant/conversations/', {
      method: 'POST',
      body: JSON.stringify(title ? { title } : {}),
    });
  }

  async getConversation(id: string): Promise<Conversation> {
    return this.request<Conversation>(`/assistant/conversations/${id}/`);
  }

  async updateConversation(id: string, data: Partial<Conversation>): Promise<Conversation> {
    return this.request<Conversation>(`/assistant/conversations/${id}/`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  async deleteConversation(id: string): Promise<void> {
    return this.request(`/assistant/conversations/${id}/`, { method: 'DELETE' });
  }

  async executeActionProposal(action_token: string, confirm: boolean): Promise<{ success: boolean; result?: any; error?: string }> {
    return this.request('/assistant/actions/execute/', {
      method: 'POST',
      body: JSON.stringify({ action_token, confirm }),
    });
  }

  async uploadAssistantDocument(file: File): Promise<{ filename: string; file_size: number; extracted_text: string; char_count: number }> {
    const formData = new FormData();
    formData.append('file', file);
    const token = this.getToken();
    const headers: Record<string, string> = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const res = await fetch(`${API_BASE_URL}/assistant/documents/upload/`, {
      method: 'POST',
      headers,
      body: formData,
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || `Upload failed with status ${res.status}`);
    }
    return res.json();
  }

  async getAssistantConfig(): Promise<AssistantConfig> {
    return this.request<AssistantConfig>('/assistant/config/');
  }

  async updateAssistantConfig(data: any): Promise<any> {
    return this.request('/assistant/config/', {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  async streamAssistantMessage(
    conversationId: string,
    message: string,
    documentContext: string = '',
    onChunk: (data: any) => void,
    signal?: AbortSignal
  ): Promise<void> {
    const token = this.getToken();
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const res = await fetch(`${API_BASE_URL}/assistant/conversations/${conversationId}/messages/stream/`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ message, document_context: documentContext }),
      signal,
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || `Streaming request failed with status ${res.status}`);
    }

    if (!res.body) throw new Error('No readable response body stream from server.');

    const reader = res.body.getReader();
    const decoder = new TextDecoder('utf-8');
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed.startsWith('data: ')) {
          try {
            const data = JSON.parse(trimmed.slice(6));
            onChunk(data);
          } catch (e) {
            console.error('Failed to parse SSE data:', trimmed, e);
          }
        }
      }
    }
  }
}

export const api = new ApiClient();
