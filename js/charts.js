/**
 * ROOT4TECH CRM - Chart.js Visualizations Engine
 * Handles role-specific charts and agency reporting graphs
 */

const CRM_CHARTS = {
  instances: {},

  destroyChart(id) {
    if (this.instances[id]) {
      this.instances[id].destroy();
      delete this.instances[id];
    }
  },

  // Chart: Sales Manager - Monthly Deal Pipeline & Revenue
  initSalesPipelineChart(canvasId) {
    const el = document.getElementById(canvasId);
    if (!el || typeof Chart === 'undefined') return;
    this.destroyChart(canvasId);

    const ctx = el.getContext('2d');
    this.instances[canvasId] = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: ['May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct (MTD)'],
        datasets: [
          {
            label: 'Won Revenue ($k)',
            data: [32, 45, 38, 52, 64, 48],
            backgroundColor: '#2563eb',
            borderRadius: 6,
            maxBarThickness: 28
          },
          {
            label: 'Pipeline Forecast ($k)',
            data: [40, 50, 48, 65, 75, 78],
            backgroundColor: '#93c5fd',
            borderRadius: 6,
            maxBarThickness: 28
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: 'top', labels: { boxWidth: 12, font: { family: 'Plus Jakarta Sans', weight: 600 } } },
          tooltip: {
            callbacks: {
              label: (context) => ` ${context.dataset.label}: $${context.raw * 1000}`
            }
          }
        },
        scales: {
          y: {
            beginAtZero: true,
            grid: { color: '#f1f5f9' },
            ticks: { callback: (val) => `$${val}k`, font: { family: 'Plus Jakarta Sans' } }
          },
          x: {
            grid: { display: false },
            ticks: { font: { family: 'Plus Jakarta Sans' } }
          }
        }
      }
    });
  },

  // Chart: Lead Conversion by Stage (Doughnut)
  initLeadStagesDoughnut(canvasId) {
    const el = document.getElementById(canvasId);
    if (!el || typeof Chart === 'undefined') return;
    this.destroyChart(canvasId);

    const data = CRM_STORE.get();
    const stageCounts = {
      'New': 0, 'Contacted': 0, 'Qualified': 0, 'Proposal Sent': 0, 'Won': 0, 'Lost': 0
    };
    (data.leads || []).forEach(l => {
      if (stageCounts[l.status] !== undefined) stageCounts[l.status]++;
    });

    const ctx = el.getContext('2d');
    this.instances[canvasId] = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: ['New', 'Contacted', 'Qualified', 'Proposal Sent', 'Won', 'Lost'],
        datasets: [{
          data: Object.values(stageCounts),
          backgroundColor: ['#38bdf8', '#6366f1', '#8b5cf6', '#f59e0b', '#10b981', '#f43f5e'],
          borderWidth: 2,
          borderColor: '#ffffff'
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '70%',
        plugins: {
          legend: { position: 'right', labels: { boxWidth: 10, font: { family: 'Plus Jakarta Sans', size: 11 } } }
        }
      }
    });
  },

  // Chart: Developer - Sprint Velocity & Task Burndown
  initDevSprintChart(canvasId) {
    const el = document.getElementById(canvasId);
    if (!el || typeof Chart === 'undefined') return;
    this.destroyChart(canvasId);

    const ctx = el.getContext('2d');
    this.instances[canvasId] = new Chart(ctx, {
      type: 'line',
      data: {
        labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
        datasets: [
          {
            label: 'Tasks Completed',
            data: [3, 5, 4, 7, 6, 2, 1],
            borderColor: '#2563eb',
            backgroundColor: 'rgba(37, 99, 235, 0.1)',
            fill: true,
            tension: 0.35,
            pointRadius: 4,
            pointBackgroundColor: '#2563eb'
          },
          {
            label: 'Bugs Resolved',
            data: [1, 2, 2, 3, 2, 0, 0],
            borderColor: '#10b981',
            backgroundColor: 'transparent',
            borderDash: [4, 4],
            tension: 0.35,
            pointRadius: 3
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: 'top', labels: { boxWidth: 12, font: { family: 'Plus Jakarta Sans' } } }
        },
        scales: {
          y: { beginAtZero: true, grid: { color: '#f1f5f9' } },
          x: { grid: { display: false } }
        }
      }
    });
  },

  // Chart: Video Editor - Render & Delivery Throughput
  initVideoEditorChart(canvasId) {
    const el = document.getElementById(canvasId);
    if (!el || typeof Chart === 'undefined') return;
    this.destroyChart(canvasId);

    const ctx = el.getContext('2d');
    this.instances[canvasId] = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: ['Week 1', 'Week 2', 'Week 3', 'Week 4'],
        datasets: [
          {
            label: 'Approved Final Cuts',
            data: [4, 6, 5, 8],
            backgroundColor: '#7e22ce',
            borderRadius: 6
          },
          {
            label: 'Revision Rounds (v2+)',
            data: [2, 3, 2, 1],
            backgroundColor: '#f59e0b',
            borderRadius: 6
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: 'top', labels: { boxWidth: 12, font: { family: 'Plus Jakarta Sans' } } }
        },
        scales: {
          y: { beginAtZero: true, grid: { color: '#f1f5f9' }, ticks: { stepSize: 1 } },
          x: { grid: { display: false } }
        }
      }
    });
  },

  // Chart: Salesperson - Weekly Calls, Meetings & Proposals
  initSalespersonActivityChart(canvasId) {
    const el = document.getElementById(canvasId);
    if (!el || typeof Chart === 'undefined') return;
    this.destroyChart(canvasId);

    const ctx = el.getContext('2d');
    this.instances[canvasId] = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: ['Discovery Calls', 'Demo Meetings', 'Proposals Sent', 'Deals Closed'],
        datasets: [{
          label: 'This Month vs Target',
          data: [28, 14, 8, 3],
          backgroundColor: ['#38bdf8', '#6366f1', '#f59e0b', '#10b981'],
          borderRadius: 6
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          y: { beginAtZero: true, grid: { color: '#f1f5f9' } },
          x: { grid: { display: false } }
        }
      }
    });
  },

  // Chart: Service Revenue Breakdown (Reports)
  initServiceBreakdownChart(canvasId) {
    const el = document.getElementById(canvasId);
    if (!el || typeof Chart === 'undefined') return;
    this.destroyChart(canvasId);

    const ctx = el.getContext('2d');
    this.instances[canvasId] = new Chart(ctx, {
      type: 'pie',
      data: {
        labels: ['Website Development', 'Video Editing', 'Branding', 'Graphic Design', 'Digital Marketing'],
        datasets: [{
          data: [48000, 28500, 16000, 9200, 18500],
          backgroundColor: ['#2563eb', '#7e22ce', '#06b6d4', '#f59e0b', '#10b981']
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: 'right', labels: { boxWidth: 10, font: { family: 'Plus Jakarta Sans', size: 11 } } },
          tooltip: {
            callbacks: {
              label: (ctx) => ` ${ctx.label}: $${ctx.raw.toLocaleString()}`
            }
          }
        }
      }
    });
  }
};

window.CRM_CHARTS = CRM_CHARTS;
