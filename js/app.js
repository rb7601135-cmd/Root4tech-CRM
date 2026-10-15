/**
 * ROOT4TECH CRM - Central Application Script
 * Provides layout orchestration, role switching, search, and shared UI helpers.
 */

// Helper to format currency
function formatCurrency(amount) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(amount);
}

// Helper to format dates
function formatDate(dateStr) {
  if (!dateStr) return 'N/A';
  const parts = dateStr.split('-');
  if (parts.length === 3) {
    const d = new Date(parts[0], parts[1] - 1, parts[2]);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }
  return dateStr;
}

// Toast notification helper
function showToast(message, type = 'success') {
  let toastContainer = document.getElementById('toast-container');
  if (!toastContainer) {
    toastContainer = document.createElement('div');
    toastContainer.id = 'toast-container';
    toastContainer.className = 'toast-container position-fixed bottom-0 end-0 p-3';
    toastContainer.style.zIndex = '9999';
    document.body.appendChild(toastContainer);
  }

  const bgClass = type === 'success' ? 'bg-success text-white' : type === 'danger' ? 'bg-danger text-white' : 'bg-primary text-white';
  const toastId = 'toast-' + Date.now();
  
  const toastEl = document.createElement('div');
  toastEl.className = `toast align-items-center ${bgClass} border-0 shadow-lg`;
  toastEl.id = toastId;
  toastEl.setAttribute('role', 'alert');
  toastEl.setAttribute('aria-live', 'assertive');
  toastEl.setAttribute('aria-atomic', 'true');
  toastEl.innerHTML = `
    <div class="d-flex">
      <div class="toast-body d-flex align-items-center gap-2">
        <i class="bi ${type === 'success' ? 'bi-check-circle-fill' : type === 'danger' ? 'bi-exclamation-triangle-fill' : 'bi-info-circle-fill'} fs-5"></i>
        <span>${message}</span>
      </div>
      <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast" aria-label="Close"></button>
    </div>
  `;

  toastContainer.appendChild(toastEl);
  const bsToast = new bootstrap.Toast(toastEl, { delay: 3500 });
  bsToast.show();
  toastEl.addEventListener('hidden.bs.toast', () => toastEl.remove());
}

// Auto-load CRM_API backend client if not directly included
if (typeof window.CRM_API === 'undefined' && typeof document !== 'undefined') {
  const existingApiScript = document.querySelector('script[src*="api.js"]');
  if (!existingApiScript && document.head) {
    const apiScript = document.createElement('script');
    apiScript.src = 'js/api.js';
    document.head.appendChild(apiScript);
  }
}

// Initialize Application Frame
document.addEventListener('DOMContentLoaded', () => {
  setupSidebar();
  setupRoleSwitcher();
  setupSearchModal();
  updateTopNavUserData();
  highlightActiveNavLink();
  if (window.CRM_API) {
    CRM_API.syncStateWithBackend();
  }
});

// Sidebar setup & collapse toggle
function setupSidebar() {
  const toggleBtn = document.getElementById('sidebar-toggle-btn');
  const mobileToggleBtn = document.getElementById('mobile-sidebar-toggle-btn');
  
  if (toggleBtn) {
    toggleBtn.addEventListener('click', () => {
      document.body.classList.toggle('sidebar-collapsed');
      localStorage.setItem('CRM_SIDEBAR_COLLAPSED', document.body.classList.contains('sidebar-collapsed'));
    });
    // Restore sidebar collapse state
    if (localStorage.getItem('CRM_SIDEBAR_COLLAPSED') === 'true') {
      document.body.classList.add('sidebar-collapsed');
    }
  }

  if (mobileToggleBtn) {
    mobileToggleBtn.addEventListener('click', () => {
      document.body.classList.toggle('sidebar-mobile-open');
    });
  }

  // Backdrop click to close on mobile
  const backdrop = document.querySelector('.sidebar-backdrop');
  if (backdrop) {
    backdrop.addEventListener('click', () => {
      document.body.classList.remove('sidebar-mobile-open');
    });
  }
}

// Highlight current page link in sidebar
function highlightActiveNavLink() {
  const currentPath = window.location.pathname;
  const pageName = currentPath.substring(currentPath.lastIndexOf('/') + 1) || 'index.html';

  const links = document.querySelectorAll('.sidebar-link');
  links.forEach(link => {
    const href = link.getAttribute('href');
    if (href === pageName || (pageName === '' && href === 'index.html')) {
      link.classList.add('active');
    } else {
      link.classList.remove('active');
    }
  });
}

// Setup Role Indicator Badge (Role switching disabled for security)
function setupRoleSwitcher() {
  // Remove any legacy role switcher dropdown menus from DOM
  const roleMenus = document.querySelectorAll('.role-badge-selector + .dropdown-menu, .dropdown:has(.role-badge-selector) .dropdown-menu');
  roleMenus.forEach(menu => menu.remove());

  // Ensure role badges reflect the authenticated logged-in user
  const user = (typeof CRM_STORE !== 'undefined') ? CRM_STORE.getCurrentUser() : null;
  const roleBadgeTexts = document.querySelectorAll('#current-role-badge-text');
  if (user && roleBadgeTexts.length > 0) {
    roleBadgeTexts.forEach(el => {
      el.textContent = user.role || 'Sales Manager';
    });
  }
}

// Update Topbar and User profile elements
function updateTopNavUserData() {
  const user = CRM_STORE.getCurrentUser();
  if (!user) return;

  // Header user info
  const nameEls = document.querySelectorAll('.current-user-name');
  const roleEls = document.querySelectorAll('.current-user-role');
  const avatarEls = document.querySelectorAll('.current-user-avatar');

  nameEls.forEach(el => el.textContent = user.name);
  roleEls.forEach(el => el.textContent = user.role);
  avatarEls.forEach(el => {
    el.textContent = user.avatar;
    el.style.backgroundColor = user.color || '#2563eb';
  });

  // Current Role Badge in topbar
  const roleBadge = document.getElementById('current-role-badge-text');
  if (roleBadge) {
    roleBadge.textContent = user.role;
  }

  // Update Notification Badge Count
  const data = CRM_STORE.get();
  const unreadCount = (data.notifications || []).filter(n => !n.read).length;
  const notifBadge = document.getElementById('topbar-notif-badge');
  if (notifBadge) {
    if (unreadCount > 0) {
      notifBadge.textContent = unreadCount;
      notifBadge.style.display = 'inline-block';
    } else {
      notifBadge.style.display = 'none';
    }
  }
}

// Setup Global Quick Search Modal
function setupSearchModal() {
  const searchModalEl = document.getElementById('globalSearchModal');
  const searchInput = document.getElementById('global-search-input');
  const searchResults = document.getElementById('global-search-results');

  if (!searchModalEl || !searchInput || !searchResults) return;

  const bsSearchModal = new bootstrap.Modal(searchModalEl);

  // Keyboard shortcut Ctrl+K or Cmd+K
  document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
      e.preventDefault();
      bsSearchModal.show();
    }
  });

  searchModalEl.addEventListener('shown.bs.modal', () => {
    searchInput.focus();
    searchInput.value = '';
    renderSearchResults('');
  });

  searchInput.addEventListener('input', (e) => {
    renderSearchResults(e.target.value.trim().toLowerCase());
  });

  function renderSearchResults(query) {
    const data = CRM_STORE.get();
    let html = '';

    if (!query) {
      html = `
        <div class="p-3 text-muted small">
          <div class="fw-bold mb-2 text-uppercase text-secondary" style="font-size: 0.72rem;">Quick Suggestions</div>
          <div class="d-flex flex-wrap gap-2">
            <a href="leads.html" class="badge bg-light text-dark text-decoration-none border p-2"><i class="bi bi-funnel me-1"></i> All Leads</a>
            <a href="projects.html" class="badge bg-light text-dark text-decoration-none border p-2"><i class="bi bi-briefcase me-1"></i> Active Projects</a>
            <a href="clients.html" class="badge bg-light text-dark text-decoration-none border p-2"><i class="bi bi-buildings me-1"></i> Client Directory</a>
            <a href="tasks.html" class="badge bg-light text-dark text-decoration-none border p-2"><i class="bi bi-check2-square me-1"></i> Team Tasks</a>
          </div>
        </div>
      `;
      searchResults.innerHTML = html;
      return;
    }

    const matchedLeads = (data.leads || []).filter(l => 
      l.name.toLowerCase().includes(query) || 
      l.company.toLowerCase().includes(query) ||
      l.serviceRequired.toLowerCase().includes(query)
    );

    const matchedProjects = (data.projects || []).filter(p => 
      p.projectName.toLowerCase().includes(query) || 
      p.client.toLowerCase().includes(query) ||
      p.serviceType.toLowerCase().includes(query)
    );

    const matchedClients = (data.clients || []).filter(c => 
      c.company.toLowerCase().includes(query) || 
      c.contactPerson.toLowerCase().includes(query)
    );

    const matchedTasks = (data.tasks || []).filter(t => 
      t.title.toLowerCase().includes(query) ||
      t.project.toLowerCase().includes(query)
    );

    let count = 0;

    if (matchedLeads.length > 0) {
      html += `<div class="px-3 pt-2 pb-1 text-secondary fw-bold small text-uppercase" style="font-size: 0.7rem;">Leads (${matchedLeads.length})</div>`;
      matchedLeads.slice(0, 3).forEach(l => {
        count++;
        html += `
          <a href="lead-details.html?id=${l.id}" class="search-result-item">
            <div class="d-flex align-items-center gap-2">
              <span class="badge bg-primary-subtle text-primary"><i class="bi bi-person"></i></span>
              <div>
                <div class="fw-semibold">${l.name} <span class="text-muted small">(${l.company})</span></div>
                <div class="text-muted small">${l.serviceRequired} &bull; ${formatCurrency(l.estimatedDealValue)}</div>
              </div>
            </div>
            <span class="badge-stage" data-stage="${l.status}">${l.status}</span>
          </a>
        `;
      });
    }

    if (matchedProjects.length > 0) {
      html += `<div class="px-3 pt-3 pb-1 text-secondary fw-bold small text-uppercase" style="font-size: 0.7rem;">Projects (${matchedProjects.length})</div>`;
      matchedProjects.slice(0, 3).forEach(p => {
        count++;
        html += `
          <a href="project-details.html?id=${p.id}" class="search-result-item">
            <div class="d-flex align-items-center gap-2">
              <span class="badge bg-info-subtle text-info"><i class="bi bi-briefcase"></i></span>
              <div>
                <div class="fw-semibold">${p.projectName}</div>
                <div class="text-muted small">${p.client} &bull; ${p.serviceType}</div>
              </div>
            </div>
            <span class="badge bg-light text-dark border small">${p.progress}%</span>
          </a>
        `;
      });
    }

    if (matchedClients.length > 0) {
      html += `<div class="px-3 pt-3 pb-1 text-secondary fw-bold small text-uppercase" style="font-size: 0.7rem;">Clients (${matchedClients.length})</div>`;
      matchedClients.slice(0, 2).forEach(c => {
        count++;
        html += `
          <a href="client-details.html?id=${c.id}" class="search-result-item">
            <div class="d-flex align-items-center gap-2">
              <span class="badge bg-success-subtle text-success"><i class="bi bi-buildings"></i></span>
              <div>
                <div class="fw-semibold">${c.company}</div>
                <div class="text-muted small">${c.contactPerson} &bull; ${c.industry}</div>
              </div>
            </div>
            <span class="text-muted small">${c.projectsCount} Projects</span>
          </a>
        `;
      });
    }

    if (matchedTasks.length > 0) {
      html += `<div class="px-3 pt-3 pb-1 text-secondary fw-bold small text-uppercase" style="font-size: 0.7rem;">Tasks (${matchedTasks.length})</div>`;
      matchedTasks.slice(0, 3).forEach(t => {
        count++;
        html += `
          <a href="tasks.html" class="search-result-item">
            <div class="d-flex align-items-center gap-2">
              <span class="badge bg-warning-subtle text-warning"><i class="bi bi-check2-circle"></i></span>
              <div>
                <div class="fw-semibold">${t.title}</div>
                <div class="text-muted small">${t.project} &bull; ${t.assignedTo}</div>
              </div>
            </div>
            <span class="badge bg-secondary-subtle text-secondary small">${t.status}</span>
          </a>
        `;
      });
    }

    if (count === 0) {
      html = `
        <div class="text-center py-4 text-muted">
          <i class="bi bi-search fs-2 mb-2 d-block text-secondary"></i>
          <div>No results found for "<strong>${query}</strong>"</div>
          <div class="small text-secondary mt-1">Try searching for a client, project name, or lead.</div>
        </div>
      `;
    }

    searchResults.innerHTML = html;
  }
}

// Global Quick Action: Add Lead
function handleAddNewLead(formData) {
  const data = CRM_STORE.get();
  const newId = 'LD-' + (100 + data.leads.length + 1);
  const newLead = {
    id: newId,
    name: formData.name,
    company: formData.company,
    email: formData.email,
    phone: formData.phone || '+1 (555) 000-0000',
    serviceRequired: formData.serviceRequired,
    leadSource: formData.leadSource || 'Website Form',
    assignedSalesperson: formData.assignedSalesperson || 'Sir Sharjeel',
    estimatedDealValue: parseFloat(formData.estimatedDealValue) || 5000,
    nextFollowUp: formData.nextFollowUp || new Date(Date.now() + 86400000 * 3).toISOString().split('T')[0],
    status: formData.status || 'New',
    createdDate: new Date().toISOString().split('T')[0],
    notes: formData.notes || 'Inquired through web form.'
  };

  data.leads.unshift(newLead);
  CRM_STORE.save(data);
  showToast(`Lead "${newLead.name}" added successfully!`);
  return newLead;
}

// Global Quick Action: Add Task
function handleAddNewTask(formData) {
  const data = CRM_STORE.get();
  const newId = 'TSK-' + (500 + data.tasks.length + 1);
  const newTask = {
    id: newId,
    title: formData.title,
    project: formData.project,
    assignedTo: formData.assignedTo,
    role: formData.role || 'dev',
    priority: formData.priority || 'Medium',
    dueDate: formData.dueDate,
    status: 'Todo'
  };

  data.tasks.unshift(newTask);
  CRM_STORE.save(data);
  showToast(`Task created: "${newTask.title}"`);
  return newTask;
}

// Global Quick Action: Add Project
function handleAddNewProject(formData) {
  const data = CRM_STORE.get();
  const newId = 'PRJ-' + (200 + data.projects.length + 1);
  const newProject = {
    id: newId,
    client: formData.client,
    projectName: formData.projectName,
    serviceType: formData.serviceType,
    assignedTeamMember: formData.assignedTeamMember,
    startDate: formData.startDate || new Date().toISOString().split('T')[0],
    deadline: formData.deadline,
    progress: 0,
    priority: formData.priority || 'Medium',
    status: 'Planning',
    budget: parseFloat(formData.budget) || 10000,
    description: formData.description || 'Newly initiated agency project.'
  };

  data.projects.unshift(newProject);
  CRM_STORE.save(data);
  showToast(`Project "${newProject.projectName}" initialized!`);
  return newProject;
}

// Global Quick Action: Convert Lead to Client directly
function handleConvertLeadToClient(leadId, redirect = false) {
  const result = CRM_STORE.convertLeadToClient(leadId);
  if (result.success) {
    showToast(`🎉 Lead "${result.lead.name}" successfully converted to Client account!`, 'success');
    if (redirect) {
      setTimeout(() => {
        window.location.href = `client-details.html?id=${result.client.id}`;
      }, 600);
    }
  } else {
    showToast(result.message || 'Conversion failed', 'danger');
  }
  return result;
}

// Helper to auto-fill service price when service is selected in forms
function autoFillServicePrice(selectEl, targetInputName = 'estimatedDealValue') {
  const selectedService = selectEl.value;
  const services = CRM_STORE.getServices();
  const matched = services.find(s => s.name === selectedService);
  if (matched && matched.price) {
    const form = selectEl.closest('form');
    if (form) {
      const input = form.querySelector(`input[name="${targetInputName}"]`);
      if (input) {
        input.value = matched.price;
      }
    }
  }
}

window.showToast = showToast;
window.formatCurrency = formatCurrency;
window.formatDate = formatDate;
window.handleAddNewLead = handleAddNewLead;
window.handleAddNewTask = handleAddNewTask;
window.handleAddNewProject = handleAddNewProject;
window.handleConvertLeadToClient = handleConvertLeadToClient;
window.autoFillServicePrice = autoFillServicePrice;


