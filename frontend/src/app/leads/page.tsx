'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { AppLayout } from '@/components/layout/AppLayout';
import { StatusBadge, PriorityBadge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { EmptyState } from '@/components/ui/StatCard';
import { useCompany } from '@/context/CompanyContext';
import { useAuth } from '@/context/AuthContext';
import { api } from '@/lib/api';
import { Lead, LeadStatus, LeadPriority, LeadSource, User, CompanyService } from '@/types/crm';
import {
  Users,
  Plus,
  Search,
  Filter,
  ArrowUpDown,
  Mail,
  Phone,
  Calendar,
  Building,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
} from 'lucide-react';

export default function LeadsPage() {
  const { formatCurrency, currency } = useCompany();
  const { user } = useAuth();

  const [leads, setLeads] = useState<Lead[]>([]);
  const [teamMembers, setTeamMembers] = useState<User[]>([]);
  const [services, setServices] = useState<CompanyService[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Filters & Search
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [priorityFilter, setPriorityFilter] = useState<string>('');
  const [assignedFilter, setAssignedFilter] = useState<string>('');

  // Create Modal state
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const [newLead, setNewLead] = useState({
    lead_name: '',
    company: '',
    email: '',
    phone: '',
    website: '',
    interested_service: '',
    estimated_budget: '',
    lead_source: 'Website' as LeadSource,
    priority: 'Medium' as LeadPriority,
    next_follow_up_date: '',
    notes: '',
    assigned_salesperson: '' as string | number,
  });

  const loadData = async () => {
    setIsLoading(true);
    try {
      const params: Record<string, string | number> = {};
      if (search) params.search = search;
      if (statusFilter) params.status = statusFilter;
      if (priorityFilter) params.priority = priorityFilter;
      if (assignedFilter) params.assigned_to = assignedFilter;

      const [leadsRes, teamRes, servicesRes] = await Promise.all([
        api.getLeads(params),
        api.getTeam(),
        api.getServices({ active_only: true }).catch(() => []),
      ]);

      const leadsList = Array.isArray(leadsRes) ? leadsRes : leadsRes.results || [];
      const teamList = Array.isArray(teamRes) ? teamRes : teamRes.results || [];
      const servicesList = Array.isArray(servicesRes) ? servicesRes : (servicesRes as { results?: CompanyService[] })?.results || [];

      setLeads(leadsList);
      setTeamMembers(teamList);
      setServices(servicesList);
    } catch (err) {
      console.error('Failed to load leads data', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [search, statusFilter, priorityFilter, assignedFilter]);

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newLead.lead_name || !newLead.email) {
      setCreateError('Lead name and email are required.');
      return;
    }

    setIsSubmitting(true);
    setCreateError(null);

    try {
      await api.createLead({
        ...newLead,
        estimated_budget: newLead.estimated_budget ? parseFloat(newLead.estimated_budget) : null,
        assigned_salesperson: newLead.assigned_salesperson ? Number(newLead.assigned_salesperson) : null,
        next_follow_up_date: newLead.next_follow_up_date || null,
      });

      setIsCreateOpen(false);
      setNewLead({
        lead_name: '',
        company: '',
        email: '',
        phone: '',
        website: '',
        interested_service: '',
        estimated_budget: '',
        lead_source: 'Website',
        priority: 'Medium',
        next_follow_up_date: '',
        notes: '',
        assigned_salesperson: '',
      });
      loadData();
    } catch (err: unknown) {
      const apiErr = err as { data?: { email?: string[]; detail?: string }; message?: string };
      setCreateError(
        apiErr.data?.email?.[0] || apiErr.data?.detail || apiErr.message || 'Failed to create lead.'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Page Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
              Lead Management
            </h1>
            <p className="text-xs sm:text-sm text-zinc-400 mt-1">
              Track, qualify, and convert potential clients into long-term accounts.
            </p>
          </div>
          <Button
            onClick={() => setIsCreateOpen(true)}
            icon={<Plus className="w-4 h-4" />}
            size="md"
          >
            Create New Lead
          </Button>
        </div>

        {/* Filter Bar */}
        <div className="p-4 rounded-xl bg-zinc-900/80 border border-zinc-800 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search leads, companies..."
                className="w-full pl-9 pr-3 py-1.5 text-xs bg-zinc-950 border border-zinc-800 rounded-lg text-zinc-100 placeholder-zinc-400 focus:outline-none focus:border-blue-500 transition"
              />
            </div>

            {/* Status Filter */}
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-1.5 text-xs bg-zinc-950 border border-zinc-800 rounded-lg text-zinc-300 focus:outline-none focus:border-blue-500 transition"
            >
              <option value="">All Statuses</option>
              <option value="New">New</option>
              <option value="Contacted">Contacted</option>
              <option value="Qualified">Qualified</option>
              <option value="Proposal">Proposal</option>
              <option value="Won">Won</option>
              <option value="Lost">Lost</option>
            </select>

            {/* Priority Filter */}
            <select
              value={priorityFilter}
              onChange={(e) => setPriorityFilter(e.target.value)}
              className="px-3 py-1.5 text-xs bg-zinc-950 border border-zinc-800 rounded-lg text-zinc-300 focus:outline-none focus:border-blue-500 transition"
            >
              <option value="">All Priorities</option>
              <option value="Low">Low</option>
              <option value="Medium">Medium</option>
              <option value="High">High</option>
              <option value="Urgent">Urgent</option>
            </select>

            {/* Salesperson Filter */}
            <select
              value={assignedFilter}
              onChange={(e) => setAssignedFilter(e.target.value)}
              className="px-3 py-1.5 text-xs bg-zinc-950 border border-zinc-800 rounded-lg text-zinc-300 focus:outline-none focus:border-blue-500 transition"
            >
              <option value="">All Salespeople</option>
              {teamMembers.map((tm) => (
                <option key={tm.id} value={tm.id}>
                  {tm.full_name || tm.email}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Leads Table */}
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 overflow-hidden shadow-sm">
          {isLoading ? (
            <div className="p-12 text-center text-xs text-zinc-400">Loading leads...</div>
          ) : leads.length === 0 ? (
            <EmptyState
              icon={<Users className="w-8 h-8 text-zinc-400" />}
              title="No leads found"
              description="Get started by creating a new lead or adjusting your filters."
              action={
                <Button size="sm" onClick={() => setIsCreateOpen(true)} icon={<Plus className="w-3.5 h-3.5" />}>
                  Create Lead
                </Button>
              }
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-zinc-300">
                <thead className="bg-zinc-900 text-zinc-400 border-b border-zinc-800 uppercase font-semibold text-[11px] tracking-wider">
                  <tr>
                    <th className="px-4 py-3">Lead & Company</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Priority</th>
                    <th className="px-4 py-3">Est. Budget</th>
                    <th className="px-4 py-3">Assigned Sales</th>
                    <th className="px-4 py-3">Next Follow-Up</th>
                    <th className="px-4 py-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800/60">
                  {leads.map((lead) => (
                    <tr
                      key={lead.id}
                      className="hover:bg-zinc-800/40 transition group"
                    >
                      <td className="px-4 py-3.5">
                        <Link
                          href={`/leads/${lead.id}`}
                          className="font-semibold text-zinc-100 group-hover:text-blue-400 transition flex items-center gap-1.5"
                        >
                          {lead.lead_name}
                          <ExternalLink className="w-3 h-3 opacity-0 group-hover:opacity-100 transition" />
                        </Link>
                        <div className="text-[11px] text-zinc-400 flex items-center gap-2 mt-0.5">
                          {lead.company && <span>{lead.company}</span>}
                          <span>•</span>
                          <span className="font-mono text-zinc-400">{lead.email}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3.5">
                        <StatusBadge status={lead.status} />
                      </td>
                      <td className="px-4 py-3.5">
                        <PriorityBadge priority={lead.priority} />
                      </td>
                      <td className="px-4 py-3.5 font-medium text-zinc-200">
                        {formatCurrency(lead.estimated_budget)}
                      </td>
                      <td className="px-4 py-3.5">
                        {lead.assigned_salesperson_details ? (
                          <span className="text-zinc-300">
                            {lead.assigned_salesperson_details.full_name || lead.assigned_salesperson_details.email}
                          </span>
                        ) : (
                          <span className="text-zinc-400 italic">Unassigned</span>
                        )}
                      </td>
                      <td className="px-4 py-3.5 font-mono text-zinc-400">
                        {lead.next_follow_up_date || '—'}
                      </td>
                      <td className="px-4 py-3.5 text-right">
                        <Link href={`/leads/${lead.id}`}>
                          <Button variant="outline" size="sm">
                            Manage
                          </Button>
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Create Lead Modal */}
      <Modal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        title="Create New Lead"
        description="Enter potential client details for tracking in Roo4Tech pipeline."
        maxWidth="xl"
      >
        <form onSubmit={handleCreateSubmit} className="space-y-4">
          {createError && (
            <div className="p-3 rounded-lg bg-rose-950/50 border border-rose-800/60 text-xs text-rose-300">
              {createError}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-zinc-300 mb-1">
                Lead Contact Name *
              </label>
              <input
                type="text"
                required
                value={newLead.lead_name}
                onChange={(e) => setNewLead({ ...newLead, lead_name: e.target.value })}
                placeholder="e.g. Asad Javed"
                className="w-full px-3 py-1.5 text-xs bg-zinc-950 border border-zinc-800 rounded-lg text-zinc-100 placeholder-zinc-400 focus:outline-none focus:border-blue-500 transition"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-zinc-300 mb-1">
                Company Name
              </label>
              <input
                type="text"
                value={newLead.company}
                onChange={(e) => setNewLead({ ...newLead, company: e.target.value })}
                placeholder="e.g. Crescent Digital"
                className="w-full px-3 py-1.5 text-xs bg-zinc-950 border border-zinc-800 rounded-lg text-zinc-100 placeholder-zinc-400 focus:outline-none focus:border-blue-500 transition"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-zinc-300 mb-1">
                Email Address *
              </label>
              <input
                type="email"
                required
                value={newLead.email}
                onChange={(e) => setNewLead({ ...newLead, email: e.target.value })}
                placeholder="asad@crescent.pk"
                className="w-full px-3 py-1.5 text-xs bg-zinc-950 border border-zinc-800 rounded-lg text-zinc-100 placeholder-zinc-400 focus:outline-none focus:border-blue-500 transition"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-zinc-300 mb-1">
                Phone Number
              </label>
              <input
                type="text"
                value={newLead.phone}
                onChange={(e) => setNewLead({ ...newLead, phone: e.target.value })}
                placeholder="+92 300 1234567"
                className="w-full px-3 py-1.5 text-xs bg-zinc-950 border border-zinc-800 rounded-lg text-zinc-100 placeholder-zinc-400 focus:outline-none focus:border-blue-500 transition"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium text-zinc-300 mb-1">
                Interested Service
              </label>
              <select
                value={newLead.interested_service}
                onChange={(e) => setNewLead({ ...newLead, interested_service: e.target.value })}
                className="w-full px-3 py-1.5 text-xs bg-zinc-950 border border-zinc-800 rounded-lg text-zinc-100 focus:outline-none focus:border-blue-500 transition"
              >
                <option value="">Select a service...</option>
                {services.map((svc) => (
                  <option key={svc.id} value={svc.name}>
                    {svc.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-zinc-300 mb-1">
                Est. Budget ({currency})
              </label>
              <input
                type="number"
                value={newLead.estimated_budget}
                onChange={(e) => setNewLead({ ...newLead, estimated_budget: e.target.value })}
                placeholder="500000"
                className="w-full px-3 py-1.5 text-xs bg-zinc-950 border border-zinc-800 rounded-lg text-zinc-100 placeholder-zinc-400 focus:outline-none focus:border-blue-500 transition"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-zinc-300 mb-1">
                Lead Source
              </label>
              <select
                value={newLead.lead_source}
                onChange={(e) => setNewLead({ ...newLead, lead_source: e.target.value as LeadSource })}
                className="w-full px-3 py-1.5 text-xs bg-zinc-950 border border-zinc-800 rounded-lg text-zinc-300 focus:outline-none focus:border-blue-500 transition"
              >
                <option value="Website">Website</option>
                <option value="Referral">Referral</option>
                <option value="LinkedIn">LinkedIn</option>
                <option value="Cold Call">Cold Call</option>
                <option value="Social Media">Social Media</option>
                <option value="Other">Other</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium text-zinc-300 mb-1">
                Priority
              </label>
              <select
                value={newLead.priority}
                onChange={(e) => setNewLead({ ...newLead, priority: e.target.value as LeadPriority })}
                className="w-full px-3 py-1.5 text-xs bg-zinc-950 border border-zinc-800 rounded-lg text-zinc-300 focus:outline-none focus:border-blue-500 transition"
              >
                <option value="Low">Low</option>
                <option value="Medium">Medium</option>
                <option value="High">High</option>
                <option value="Urgent">Urgent</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-zinc-300 mb-1">
                Assign Salesperson
              </label>
              <select
                value={newLead.assigned_salesperson}
                onChange={(e) => setNewLead({ ...newLead, assigned_salesperson: e.target.value })}
                className="w-full px-3 py-1.5 text-xs bg-zinc-950 border border-zinc-800 rounded-lg text-zinc-300 focus:outline-none focus:border-blue-500 transition"
              >
                <option value="">Unassigned</option>
                {teamMembers.map((tm) => (
                  <option key={tm.id} value={tm.id}>
                    {tm.full_name || tm.email} ({tm.role})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-zinc-300 mb-1">
                Next Follow-Up Date
              </label>
              <input
                type="date"
                value={newLead.next_follow_up_date}
                onChange={(e) => setNewLead({ ...newLead, next_follow_up_date: e.target.value })}
                className="w-full px-3 py-1.5 text-xs bg-zinc-950 border border-zinc-800 rounded-lg text-zinc-300 focus:outline-none focus:border-blue-500 transition"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-zinc-300 mb-1">
              Initial Discovery Notes
            </label>
            <textarea
              rows={2}
              value={newLead.notes}
              onChange={(e) => setNewLead({ ...newLead, notes: e.target.value })}
              placeholder="Requirements and background details..."
              className="w-full px-3 py-2 text-xs bg-zinc-950 border border-zinc-800 rounded-lg text-zinc-100 placeholder-zinc-400 focus:outline-none focus:border-blue-500 transition"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-zinc-800">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsCreateOpen(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button type="submit" size="sm" isLoading={isSubmitting}>
              Create Lead
            </Button>
          </div>
        </form>
      </Modal>
    </AppLayout>
  );
}
