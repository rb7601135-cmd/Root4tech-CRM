'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { AppLayout } from '@/components/layout/AppLayout';
import { StatusBadge, RoleBadge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { EmptyState } from '@/components/ui/StatCard';
import { useAuth } from '@/context/AuthContext';
import { api } from '@/lib/api';
import { Client, ClientStatus, User } from '@/types/crm';
import {
  Building2,
  Plus,
  Search,
  Filter,
  Mail,
  Phone,
  Building,
  Archive,
  ExternalLink,
  ShieldAlert,
} from 'lucide-react';

export default function ClientsPage() {
  const { user } = useAuth();

  const [clients, setClients] = useState<Client[]>([]);
  const [teamMembers, setTeamMembers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Search & Filters
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [assignedFilter, setAssignedFilter] = useState<string>('');

  // Create Modal state
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const [newClient, setNewClient] = useState({
    name: '',
    company_name: '',
    email: '',
    phone: '',
    website: '',
    billing_address: '',
    service_interests: '',
    client_status: 'Active' as ClientStatus,
    notes: '',
    assigned_team_member: '' as string | number,
  });

  const loadData = async () => {
    setIsLoading(true);
    try {
      const params: Record<string, string | number> = {};
      if (search) params.search = search;
      if (statusFilter) params.status = statusFilter;
      if (assignedFilter) params.assigned_to = assignedFilter;

      const [clientsRes, teamRes] = await Promise.all([
        api.getClients(params),
        api.getTeam(),
      ]);

      const clientList = Array.isArray(clientsRes) ? clientsRes : clientsRes.results || [];
      const teamList = Array.isArray(teamRes) ? teamRes : teamRes.results || [];

      setClients(clientList);
      setTeamMembers(teamList);
    } catch (err) {
      console.error('Failed to load clients', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [search, statusFilter, assignedFilter]);

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newClient.name || !newClient.email) {
      setCreateError('Client contact name and email are required.');
      return;
    }

    setIsSubmitting(true);
    setCreateError(null);

    try {
      await api.createClient({
        ...newClient,
        assigned_team_member: newClient.assigned_team_member ? Number(newClient.assigned_team_member) : null,
      });

      setIsCreateOpen(false);
      setNewClient({
        name: '',
        company_name: '',
        email: '',
        phone: '',
        website: '',
        billing_address: '',
        service_interests: '',
        client_status: 'Active',
        notes: '',
        assigned_team_member: '',
      });
      loadData();
    } catch (err: unknown) {
      const apiErr = err as { data?: { email?: string[]; detail?: string }; message?: string };
      setCreateError(
        apiErr.data?.email?.[0] || apiErr.data?.detail || apiErr.message || 'Failed to create client.'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleArchive = async (id: number, name: string) => {
    if (!confirm(`Are you sure you want to archive client '${name}'?`)) return;
    try {
      await api.archiveClient(id);
      loadData();
    } catch (err) {
      alert((err as Error).message || 'Failed to archive client.');
    }
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
              Client Management
            </h1>
            <p className="text-xs sm:text-sm text-zinc-400 mt-1">
              Central database of Roo4Tech clients with persistent IDs and multi-module relationships.
            </p>
          </div>
          <Button
            onClick={() => setIsCreateOpen(true)}
            icon={<Plus className="w-4 h-4" />}
            size="md"
          >
            Create Client
          </Button>
        </div>

        {/* Filters */}
        <div className="p-4 rounded-xl bg-zinc-900/80 border border-zinc-800 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by ID, name, email, company, phone..."
                className="w-full pl-9 pr-3 py-1.5 text-xs bg-zinc-950 border border-zinc-800 rounded-lg text-zinc-100 placeholder-zinc-400 focus:outline-none focus:border-blue-500 transition"
              />
            </div>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-1.5 text-xs bg-zinc-950 border border-zinc-800 rounded-lg text-zinc-300 focus:outline-none focus:border-blue-500 transition"
            >
              <option value="">All Statuses</option>
              <option value="Active">Active</option>
              <option value="Lead_Converted">Converted from Lead</option>
              <option value="Inactive">Inactive</option>
              <option value="Archived">Archived</option>
            </select>

            <select
              value={assignedFilter}
              onChange={(e) => setAssignedFilter(e.target.value)}
              className="px-3 py-1.5 text-xs bg-zinc-950 border border-zinc-800 rounded-lg text-zinc-300 focus:outline-none focus:border-blue-500 transition"
            >
              <option value="">All Assigned Team Members</option>
              {teamMembers.map((tm) => (
                <option key={tm.id} value={tm.id}>
                  {tm.full_name || tm.email}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Clients Table */}
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 overflow-hidden shadow-sm">
          {isLoading ? (
            <div className="p-12 text-center text-xs text-zinc-400">Loading clients...</div>
          ) : clients.length === 0 ? (
            <EmptyState
              icon={<Building2 className="w-8 h-8 text-zinc-400" />}
              title="No clients found"
              description="Create a client manually or convert qualified leads."
              action={
                <Button size="sm" onClick={() => setIsCreateOpen(true)} icon={<Plus className="w-3.5 h-3.5" />}>
                  Create Client
                </Button>
              }
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-zinc-300">
                <thead className="bg-zinc-900 text-zinc-400 border-b border-zinc-800 uppercase font-semibold text-[11px] tracking-wider">
                  <tr>
                    <th className="px-4 py-3">Client ID</th>
                    <th className="px-4 py-3">Name & Company</th>
                    <th className="px-4 py-3">Email & Phone</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Assigned Member</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800/60">
                  {clients.map((client) => (
                    <tr
                      key={client.id}
                      className="hover:bg-zinc-800/40 transition group"
                    >
                      <td className="px-4 py-3.5">
                        <Link
                          href={`/clients/${client.id}`}
                          className="font-mono font-bold text-blue-400 hover:underline"
                        >
                          {client.client_id}
                        </Link>
                      </td>
                      <td className="px-4 py-3.5">
                        <Link
                          href={`/clients/${client.id}`}
                          className="font-semibold text-zinc-100 group-hover:text-blue-400 transition flex items-center gap-1.5"
                        >
                          {client.name}
                          <ExternalLink className="w-3 h-3 opacity-0 group-hover:opacity-100 transition" />
                        </Link>
                        {client.company_name && (
                          <span className="text-[11px] text-zinc-400 block mt-0.5">
                            {client.company_name}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3.5">
                        <span className="font-mono text-zinc-300 block">{client.email}</span>
                        {client.phone && (
                          <span className="text-[11px] text-zinc-400 block mt-0.5">
                            {client.phone}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3.5">
                        <StatusBadge status={client.client_status} />
                      </td>
                      <td className="px-4 py-3.5">
                        {client.assigned_team_member_details ? (
                          <span className="text-zinc-300">
                            {client.assigned_team_member_details.full_name || client.assigned_team_member_details.email}
                          </span>
                        ) : (
                          <span className="text-zinc-400 italic">Unassigned</span>
                        )}
                      </td>
                      <td className="px-4 py-3.5 text-right space-x-2">
                        <Link href={`/clients/${client.id}`}>
                          <Button variant="outline" size="sm">
                            View Profile
                          </Button>
                        </Link>
                        {client.client_status !== 'Archived' && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleArchive(client.id, client.name)}
                            title="Archive Client"
                          >
                            <Archive className="w-3.5 h-3.5 text-zinc-400 hover:text-amber-400" />
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Create Client Modal */}
      <Modal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        title="Create New Client"
        description="Add a permanent client record to the central Roo4Tech database."
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
                Primary Contact Name *
              </label>
              <input
                type="text"
                required
                value={newClient.name}
                onChange={(e) => setNewClient({ ...newClient, name: e.target.value })}
                placeholder="e.g. Bilal Ahmed"
                className="w-full px-3 py-1.5 text-xs bg-zinc-950 border border-zinc-800 rounded-lg text-zinc-100 placeholder-zinc-400 focus:outline-none focus:border-blue-500 transition"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-zinc-300 mb-1">
                Company Name
              </label>
              <input
                type="text"
                value={newClient.company_name}
                onChange={(e) => setNewClient({ ...newClient, company_name: e.target.value })}
                placeholder="e.g. TechPulse Global"
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
                value={newClient.email}
                onChange={(e) => setNewClient({ ...newClient, email: e.target.value })}
                placeholder="bilal@techpulse.io"
                className="w-full px-3 py-1.5 text-xs bg-zinc-950 border border-zinc-800 rounded-lg text-zinc-100 placeholder-zinc-400 focus:outline-none focus:border-blue-500 transition"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-zinc-300 mb-1">
                Phone Number
              </label>
              <input
                type="text"
                value={newClient.phone}
                onChange={(e) => setNewClient({ ...newClient, phone: e.target.value })}
                placeholder="+92 301 5551234"
                className="w-full px-3 py-1.5 text-xs bg-zinc-950 border border-zinc-800 rounded-lg text-zinc-100 placeholder-zinc-400 focus:outline-none focus:border-blue-500 transition"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-zinc-300 mb-1">
                Website
              </label>
              <input
                type="text"
                value={newClient.website}
                onChange={(e) => setNewClient({ ...newClient, website: e.target.value })}
                placeholder="https://techpulse.io"
                className="w-full px-3 py-1.5 text-xs bg-zinc-950 border border-zinc-800 rounded-lg text-zinc-100 placeholder-zinc-400 focus:outline-none focus:border-blue-500 transition"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-zinc-300 mb-1">
                Service Interests
              </label>
              <input
                type="text"
                value={newClient.service_interests}
                onChange={(e) => setNewClient({ ...newClient, service_interests: e.target.value })}
                placeholder="Custom Web App, Next.js"
                className="w-full px-3 py-1.5 text-xs bg-zinc-950 border border-zinc-800 rounded-lg text-zinc-100 placeholder-zinc-400 focus:outline-none focus:border-blue-500 transition"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-zinc-300 mb-1">
              Billing Address
            </label>
            <textarea
              rows={2}
              value={newClient.billing_address}
              onChange={(e) => setNewClient({ ...newClient, billing_address: e.target.value })}
              placeholder="Full invoice address..."
              className="w-full px-3 py-2 text-xs bg-zinc-950 border border-zinc-800 rounded-lg text-zinc-100 placeholder-zinc-400 focus:outline-none focus:border-blue-500 transition"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-zinc-300 mb-1">
                Client Status
              </label>
              <select
                value={newClient.client_status}
                onChange={(e) => setNewClient({ ...newClient, client_status: e.target.value as ClientStatus })}
                className="w-full px-3 py-1.5 text-xs bg-zinc-950 border border-zinc-800 rounded-lg text-zinc-300 focus:outline-none focus:border-blue-500 transition"
              >
                <option value="Active">Active</option>
                <option value="Inactive">Inactive</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-zinc-300 mb-1">
                Assigned Team Member
              </label>
              <select
                value={newClient.assigned_team_member}
                onChange={(e) => setNewClient({ ...newClient, assigned_team_member: e.target.value })}
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
              Create Client
            </Button>
          </div>
        </form>
      </Modal>
    </AppLayout>
  );
}
