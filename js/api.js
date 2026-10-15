/**
 * Root4Tech CRM - Backend API Client (Phase 2)
 * Connects the frontend to Django REST Framework endpoints.
 */

function getCookie(name) {
  let cookieValue = null;
  if (document.cookie && document.cookie !== '') {
    const cookies = document.cookie.split(';');
    for (let i = 0; i < cookies.length; i++) {
      const cookie = cookies[i].trim();
      if (cookie.substring(0, name.length + 1) === (name + '=')) {
        cookieValue = decodeURIComponent(cookie.substring(name.length + 1));
        break;
      }
    }
  }
  return cookieValue;
}

const CRM_API = {
  baseUrl: (() => {
    if (typeof window !== 'undefined' && window.location) {
      const port = window.location.port;
      const hostname = window.location.hostname;
      // If running on a static dev server like VS Code Live Server (port 5500) or other frontend dev ports,
      // route backend API requests to Django on port 8000
      if ((hostname === '127.0.0.1' || hostname === 'localhost') && port && port !== '8000') {
        return 'http://127.0.0.1:8000';
      }
      if (window.location.origin && window.location.origin.startsWith('http')) {
        return window.location.origin;
      }
    }
    return 'http://127.0.0.1:8000';
  })(),

  async request(endpoint, options = {}) {
    const url = endpoint.startsWith('http') ? endpoint : `${this.baseUrl}${endpoint}`;
    const headers = {
      'Content-Type': 'application/json',
      'X-Requested-With': 'XMLHttpRequest',
      ...options.headers,
    };

    const csrfToken = getCookie('csrftoken');
    if (csrfToken && !['GET', 'HEAD', 'OPTIONS'].includes((options.method || 'GET').toUpperCase())) {
      headers['X-CSRFToken'] = csrfToken;
    }

    try {
      const fetchOpts = {
        ...options,
        headers,
      };
      if (window.location.protocol.startsWith('http')) {
        fetchOpts.credentials = 'include';
      }
      const response = await fetch(url, fetchOpts);

      if (!response.ok) {
        let errorData = {};
        try {
          errorData = await response.json();
        } catch (_) {
          // If response was not JSON (e.g. static server 500/404 HTML page)
          errorData = {};
        }
        throw new Error(errorData.message || errorData.detail || `Server error (${response.status})`);
      }

      return await response.json().catch(() => ({}));
    } catch (err) {
      console.warn(`[CRM_API] Notice on ${endpoint}:`, err.message);
      throw err;
    }
  },

  // State Hydration from Django Database
  async syncStateWithBackend() {
    try {
      const data = await this.request('/api/crm/bundle/');
      if (data && data.teamMembers) {
        CRM_STORE.save(data);
        if (typeof updateTopNavUserData === 'function') updateTopNavUserData();
        if (typeof setupRoleSwitcher === 'function') setupRoleSwitcher();
        console.log('✅ Synchronized frontend state with live Django database queries.');
        return data;
      }
    } catch (err) {
      // Graceful fallback to localStorage if backend server is not active
      console.info('[CRM_API] Running with localized state store.');
      return null;
    }
  },

  // Auth Operations
  async login(email, password) {
    const res = await this.request('/api/auth/login/', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    if (res.success) {
      await this.syncStateWithBackend();
    }
    return res;
  },

  async logout() {
    return await this.request('/api/auth/logout/', { method: 'POST' });
  },

  async getCurrentUser() {
    return await this.request('/api/auth/me/');
  },

  async switchPersona(roleKey) {
    console.warn('Persona switching is disabled for security.');
    return { success: false, error: 'Persona switching is disabled.' };
  },

  // Leads
  async createLead(leadData) {
    return await this.request('/api/leads/', {
      method: 'POST',
      body: JSON.stringify(leadData),
    });
  },

  async updateLead(leadId, leadData) {
    return await this.request(`/api/leads/${leadId}/`, {
      method: 'PATCH',
      body: JSON.stringify(leadData),
    });
  },

  async convertLead(leadId) {
    return await this.request(`/api/leads/${leadId}/convert/`, {
      method: 'POST',
    });
  },

  async archiveLead(leadId) {
    return await this.request(`/api/leads/${leadId}/archive/`, {
      method: 'POST',
    });
  },

  // Clients
  async createClient(clientData) {
    return await this.request('/api/clients/', {
      method: 'POST',
      body: JSON.stringify(clientData),
    });
  },

  // Projects
  async createProject(projectData) {
    return await this.request('/api/projects/', {
      method: 'POST',
      body: JSON.stringify(projectData),
    });
  },

  async updateProject(projectId, projectData) {
    return await this.request(`/api/projects/${projectId}/`, {
      method: 'PATCH',
      body: JSON.stringify(projectData),
    });
  },

  // Tasks
  async createTask(taskData) {
    return await this.request('/api/tasks/', {
      method: 'POST',
      body: JSON.stringify(taskData),
    });
  },

  // Invoices & Statements
  async createInvoice(invoiceData) {
    return await this.request('/api/invoices/', {
      method: 'POST',
      body: JSON.stringify(invoiceData),
    });
  },

  async markInvoicePaid(invoiceId) {
    return await this.request(`/api/invoices/${invoiceId}/mark_paid/`, {
      method: 'POST',
    });
  },

  async createQuotation(quotationData) {
    return await this.request('/api/quotations/', {
      method: 'POST',
      body: JSON.stringify(quotationData),
    });
  },

  // Notifications
  async markNotificationsRead() {
    return await this.request('/api/notifications/mark_all_read/', {
      method: 'POST',
    });
  },
};

window.CRM_API = CRM_API;

// Auto-sync with live Django server on load
document.addEventListener('DOMContentLoaded', () => {
  CRM_API.syncStateWithBackend().then(data => {
    if (data) {
      if (typeof renderRoleDashboard === 'function') {
        const role = CRM_STORE.getCurrentRole();
        renderRoleDashboard(role);
      } else if (typeof renderLeadsTable === 'function') {
        renderLeadsTable();
      } else if (typeof renderInvoices === 'function') {
        renderInvoices();
      } else if (typeof renderTeam === 'function') {
        renderTeam();
      }
    }
  }).catch(() => {});
});
