/**
 * ROOT4TECH CRM - Sample Dataset & LocalStorage Store
 * Digital Agency Management System
 */

const DEFAULT_DATA = {
  // Current active staff role: 'sales_mgr' | 'sales' | 'dev' | 'editor'
  currentRole: 'sales_mgr',

  // Four Staff Members
  teamMembers: [
    {
      id: 'sales_mgr_1',
      name: 'Sir Sharjeel',
      role: 'Sales Manager',
      roleKey: 'sales_mgr',
      email: 'sharjeel@root4tech.com',
      phone: '+1 (555) 492-1144',
      avatar: 'SS',
      color: '#059669',
      skills: ['Sales Management', 'Pipeline Strategy', 'Deal Closing', 'Client Acquisition', 'Agency Growth'],
      activeProjectsCount: 0,
      leadsManagedCount: 0,
      wonDealsThisMonth: 0,
      status: 'Active'
    },
    {
      id: 'dev_1',
      name: 'Sir Ali',
      role: 'Full-Stack Developer',
      roleKey: 'dev',
      email: 'ali@root4tech.com',
      phone: '+1 (555) 349-2180',
      avatar: 'SA',
      color: '#2563eb',
      skills: ['Full-Stack Development', 'React', 'Django', 'REST APIs', 'PostgreSQL', 'Cloud Architecture'],
      activeProjectsCount: 0,
      pendingTasksCount: 0,
      openBugsCount: 0,
      status: 'Active'
    },
    {
      id: 'editor_1',
      name: 'Sir Murad',
      role: 'Video Editor',
      roleKey: 'editor',
      email: 'murad@root4tech.com',
      phone: '+1 (555) 781-9921',
      avatar: 'SM',
      color: '#7e22ce',
      skills: ['Video Editing', 'DaVinci Resolve', 'Color Grading', 'After Effects', 'Premiere Pro', 'Visual Effects'],
      activeProjectsCount: 0,
      pendingTasksCount: 0,
      openRevisionsCount: 0,
      status: 'Active'
    },
    {
      id: 'admin_1',
      name: 'Root4Tech Admin',
      role: 'Agency Administrator',
      roleKey: 'admin',
      email: 'admin@root4tech.com',
      phone: '+1 (555) 010-0001',
      avatar: 'RA',
      color: '#0f172a',
      skills: ['Agency Operations', 'System Administration', 'Access Control', 'Finance'],
      activeProjectsCount: 0,
      pendingTasksCount: 0,
      openRevisionsCount: 0,
      status: 'Active'
    }
  ],

  // Configurable Service Catalog with Pricing
  services: [
    {
      id: 'SVC-1',
      name: 'Website Development',
      category: 'Development',
      price: 5500,
      unit: 'per project',
      description: 'Custom responsive web applications, frontend portals & Django API backends.'
    },
    {
      id: 'SVC-2',
      name: 'Video Editing',
      category: 'Video Production',
      price: 2500,
      unit: 'per video / campaign',
      description: 'Commercial 4K edits, color grading, sound design & social cutdowns.'
    },
    {
      id: 'SVC-3',
      name: 'Branding',
      category: 'Creative Design',
      price: 3500,
      unit: 'per package',
      description: 'Full brand identity systems, typography, color guides & logo assets.'
    },
    {
      id: 'SVC-4',
      name: 'Graphic Design',
      category: 'Creative Design',
      price: 1800,
      unit: 'monthly retainer / assets',
      description: 'Marketing collateral, pitch decks, ad creatives & social media banners.'
    },
    {
      id: 'SVC-5',
      name: 'Digital Marketing',
      category: 'Marketing',
      price: 3000,
      unit: 'monthly retainer',
      description: 'Performance advertising (PPC), search engine optimization (SEO) & funnel strategy.'
    }
  ],

  // Lead Pipeline
  pipelineStages: ['New', 'Contacted', 'Qualified', 'Proposal Sent', 'Won', 'Lost'],

  // Fresh Clean Slate for Real Root4Tech Team
  leads: [],
  clients: [],
  projects: [],
  tasks: [],
  invoices: [],
  calendarEvents: [],
  notifications: []
};

// Data Store with LocalStorage Persistence
const CRM_STORE = {
  get() {
    const raw = localStorage.getItem('ROOT4TECH_CRM_STATE');
    let data;
    if (!raw) {
      this.save(DEFAULT_DATA);
      data = JSON.parse(JSON.stringify(DEFAULT_DATA));
    } else {
      try {
        data = JSON.parse(raw);
        // Auto-purge legacy demo staff if detected
        if (data.teamMembers && data.teamMembers.some(m => m.name === 'Alex Turner' || m.name === 'David Vance')) {
          this.save(DEFAULT_DATA);
          data = JSON.parse(JSON.stringify(DEFAULT_DATA));
        }
      } catch (e) {
        console.error('Error parsing stored CRM data, restoring default:', e);
        this.save(DEFAULT_DATA);
        data = JSON.parse(JSON.stringify(DEFAULT_DATA));
      }
    }

    // Auto-migrate services if stored as legacy array of strings
    if (data.services && data.services.length > 0 && typeof data.services[0] === 'string') {
      const defaultMap = {};
      DEFAULT_DATA.services.forEach(s => defaultMap[s.name] = s);
      data.services = data.services.map((svcName, idx) => {
        if (defaultMap[svcName]) return defaultMap[svcName];
        return {
          id: 'SVC-' + (idx + 1),
          name: svcName,
          category: 'Agency Service',
          price: 2500,
          unit: 'per project',
          description: 'Custom agency service deliverables.'
        };
      });
      this.save(data);
    }

    // Ensure all invoices have createdBy populated
    if (data.invoices && data.invoices.length > 0) {
      let updated = false;
      data.invoices.forEach((inv, i) => {
        if (!inv.createdBy) {
          inv.createdBy = i % 2 === 0 ? 'David Vance' : 'Sarah Jenkins';
          inv.createdRole = i % 2 === 0 ? 'Sales Manager' : 'Salesperson';
          updated = true;
        }
      });
      if (updated) this.save(data);
    }

    return data;
  },

  save(data) {
    localStorage.setItem('ROOT4TECH_CRM_STATE', JSON.stringify(data));
  },

  reset() {
    localStorage.removeItem('ROOT4TECH_CRM_STATE');
    return this.get();
  },

  getCurrentRole() {
    const data = this.get();
    return data.currentRole || 'sales_mgr';
  },

  setCurrentRole(roleKey) {
    const data = this.get();
    data.currentRole = roleKey;
    this.save(data);
  },

  getCurrentUser() {
    const data = this.get();
    const roleKey = data.currentRole || 'sales_mgr';
    const members = data.teamMembers || DEFAULT_DATA.teamMembers;
    return members.find(m => m.roleKey === roleKey || m.id === roleKey) || members[0];
  },

  // Team Member Management
  getTeamMembers() {
    const data = this.get();
    return data.teamMembers || DEFAULT_DATA.teamMembers;
  },

  getTeamMemberById(id) {
    const members = this.getTeamMembers();
    return members.find(m => m.id === id || m.roleKey === id);
  },

  saveTeamMember(member) {
    const data = this.get();
    if (!data.teamMembers) data.teamMembers = [...DEFAULT_DATA.teamMembers];

    const existingIndex = data.teamMembers.findIndex(m => m.id === member.id || (member.id && m.roleKey === member.id));
    if (existingIndex >= 0) {
      data.teamMembers[existingIndex] = {
        ...data.teamMembers[existingIndex],
        ...member
      };
    } else {
      const newId = member.id || 'staff_' + Date.now();
      const newMember = {
        id: newId,
        roleKey: member.roleKey || newId,
        name: member.name || 'New Staff Member',
        role: member.role || 'Staff Specialist',
        email: member.email || 'staff@root4tech.com',
        phone: member.phone || '+1 (555) 000-0000',
        avatar: member.avatar || (member.name ? member.name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase() : 'TM'),
        color: member.color || '#2563eb',
        skills: member.skills || ['Client Management'],
        activeProjectsCount: member.activeProjectsCount || 0,
        pendingTasksCount: member.pendingTasksCount || 0,
        status: member.status || 'Active',
        ...member
      };
      data.teamMembers.push(newMember);
    }
    this.save(data);
    return data.teamMembers;
  },

  deleteTeamMember(id) {
    const data = this.get();
    if (!data.teamMembers || data.teamMembers.length <= 1) return false;
    data.teamMembers = data.teamMembers.filter(m => m.id !== id && m.roleKey !== id);
    if (data.currentRole === id) {
      data.currentRole = data.teamMembers[0] ? (data.teamMembers[0].roleKey || data.teamMembers[0].id) : 'sales_mgr';
    }
    this.save(data);
    return true;
  },

  // Helper to get services array
  getServices() {
    const data = this.get();
    return data.services || DEFAULT_DATA.services;
  },

  // Direct Lead to Client Conversion Engine
  convertLeadToClient(leadId) {
    if (window.CRM_API && typeof CRM_API.convertLead === 'function') {
      CRM_API.convertLead(leadId).catch(err => console.warn('[CRM_API] Backend lead conversion sync notice:', err.message));
    }
    const data = this.get();
    const lead = (data.leads || []).find(l => l.id === leadId);
    if (!lead) {
      return { success: false, message: 'Lead not found.' };
    }

    // Check if client company already exists
    let existingClient = (data.clients || []).find(c => 
      c.company.trim().toLowerCase() === lead.company.trim().toLowerCase()
    );

    let clientResult;
    if (existingClient) {
      // Update existing client
      existingClient.totalSpent = (existingClient.totalSpent || 0) + (lead.estimatedDealValue || 0);
      existingClient.projectsCount = (existingClient.projectsCount || 0) + 1;
      clientResult = existingClient;
    } else {
      // Create new Client
      const newClientId = 'CLI-' + String((data.clients || []).length + 1).padStart(2, '0');
      clientResult = {
        id: newClientId,
        company: lead.company,
        contactPerson: lead.name,
        email: lead.email,
        phone: lead.phone || '+1 (555) 000-0000',
        industry: lead.serviceRequired || 'Digital Agency Services',
        totalSpent: lead.estimatedDealValue || 0,
        projectsCount: 1,
        status: 'Active',
        address: 'Direct Client Account',
        convertedFromLeadId: lead.id,
        convertedDate: new Date().toISOString().split('T')[0]
      };
      if (!data.clients) data.clients = [];
      data.clients.unshift(clientResult);
    }

    // Mark lead as Won & Converted
    lead.status = 'Won';
    lead.isConverted = true;
    lead.convertedClientId = clientResult.id;
    lead.notes = (lead.notes || '') + `\n[Converted to Client ${clientResult.company} on ${new Date().toLocaleDateString()}]`;

    // Add activity notification
    data.notifications = data.notifications || [];
    data.notifications.unshift({
      id: 'NOTIF-' + Date.now(),
      title: 'Lead Converted to Client!',
      message: `${lead.name} (${lead.company}) has been converted to an active Client account (${clientResult.id}).`,
      category: 'sales',
      time: 'Just now',
      read: false,
      role: 'all'
    });

    this.save(data);
    return { success: true, client: clientResult, lead: lead };
  }
};

window.CRM_STORE = CRM_STORE;

