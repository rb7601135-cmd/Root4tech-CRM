'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useParams } from 'next/navigation';
import { AppLayout } from '@/components/layout/AppLayout';
import { StatusBadge, RoleBadge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { EmptyState } from '@/components/ui/StatCard';
import { useCompany } from '@/context/CompanyContext';
import { useAuth } from '@/context/AuthContext';
import { api } from '@/lib/api';
import { Client, User } from '@/types/crm';
import {
  ArrowLeft,
  Building,
  Mail,
  Phone,
  Globe,
  MapPin,
  Briefcase,
  Calendar,
  MessageSquare,
  Activity,
  FileSpreadsheet,
  Receipt,
  FolderKanban,
  FileText,
  Send,
  Edit,
  Archive,
  Layers,
  Clock,
  ExternalLink,
  ShieldAlert,
  CreditCard,
  Plus,
  CheckCircle2,
  DollarSign,
  AlertCircle,
} from 'lucide-react';

export default function ClientProfilePage() {
  const router = useRouter();
  const routeParams = useParams();
  const id = (routeParams?.id as string) || '';

  const { user } = useAuth();
  const { formatCurrency, currency } = useCompany();

  const [client, setClient] = useState<Client | null>(null);
  const [teamMembers, setTeamMembers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Tab State
  const [activeTab, setActiveTab] = useState<
    'overview' | 'notes' | 'activity' | 'quotations' | 'invoices' | 'projects' | 'calendar' | 'documents'
  >('overview');

  // Add Note State
  const [noteContent, setNoteContent] = useState('');
  const [isAddingNote, setIsAddingNote] = useState(false);

  // Edit Modal State
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editData, setEditData] = useState<Partial<Client>>({});
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  const loadClient = async () => {
    if (!id) return;
    try {
      const data = await api.getClient(id);
      setClient(data);
      setEditData({
        name: data.name,
        company_name: data.company_name,
        email: data.email,
        phone: data.phone,
        website: data.website,
        billing_address: data.billing_address,
        service_interests: data.service_interests,
        client_status: data.client_status,
        assigned_team_member: data.assigned_team_member,
      });
    } catch (err) {
      console.error('Failed to load client profile', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadClient();
    api.getTeam().then((res) => {
      setTeamMembers(Array.isArray(res) ? res : res.results || []);
    });
  }, [id]);

  const handleAddNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!noteContent.trim() || !client) return;

    setIsAddingNote(true);
    try {
      await api.addClientNote(client.id, noteContent.trim());
      setNoteContent('');
      loadClient();
    } catch (err) {
      console.error('Failed to add client note', err);
    } finally {
      setIsAddingNote(false);
    }
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!client) return;

    setIsSavingEdit(true);
    try {
      await api.updateClient(client.id, editData);
      setIsEditOpen(false);
      loadClient();
    } catch (err) {
      console.error('Failed to update client profile', err);
    } finally {
      setIsSavingEdit(false);
    }
  };

  if (isLoading) {
    return (
      <AppLayout>
        <div className="p-12 text-center text-xs text-zinc-400">Loading client profile...</div>
      </AppLayout>
    );
  }

  if (!client) {
    return (
      <AppLayout>
        <div className="p-12 text-center">
          <p className="text-zinc-400 text-sm">Client profile not found.</p>
          <Link href="/clients" className="text-blue-400 text-xs hover:underline mt-2 inline-block">
            Back to Clients
          </Link>
        </div>
      </AppLayout>
    );
  }

  const tabs: Array<{ id: typeof activeTab; label: string; icon: React.ComponentType<{ className?: string }>; badge?: string }> = [
    { id: 'overview', label: 'Overview', icon: Building },
    { id: 'quotations', label: `Quotations (${client.linked_records?.quotations_count ?? 0})`, icon: FileSpreadsheet },
    { id: 'invoices', label: `Invoices & Payments (${client.linked_records?.invoices_count ?? 0})`, icon: Receipt },
    { id: 'projects', label: `Projects (${client.linked_records?.projects_count ?? 0})`, icon: FolderKanban },
    { id: 'calendar', label: `Follow-ups (${client.linked_records?.calendar_events_count ?? 0})`, icon: Calendar },
    { id: 'notes', label: `Notes (${client.notes_list?.length ?? 0})`, icon: MessageSquare },
    { id: 'activity', label: 'Activity Timeline', icon: Activity },
    { id: 'documents', label: 'Documents', icon: FileText },
  ];

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Back Link & Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-zinc-800">
          <div className="flex items-center gap-3">
            <Link
              href="/clients"
              className="p-2 rounded-lg bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 text-zinc-400 hover:text-zinc-100 transition"
            >
              <ArrowLeft className="w-4 h-4" />
            </Link>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs font-bold text-blue-400 bg-blue-950/60 px-2 py-0.5 rounded border border-blue-900/60">
                  {client.client_id}
                </span>
                <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
                  {client.name}
                </h1>
                <StatusBadge status={client.client_status} />
              </div>
              <p className="text-xs text-zinc-400 mt-0.5">
                {client.company_name ? `${client.company_name} • ` : ''}Client profile established on{' '}
                {new Date(client.created_at).toLocaleDateString()}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsEditOpen(true)}
              icon={<Edit className="w-3.5 h-3.5" />}
            >
              Edit Profile
            </Button>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center gap-1 overflow-x-auto border-b border-zinc-800 pb-px">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as typeof activeTab)}
                className={`flex items-center gap-2 px-3.5 py-2.5 text-xs font-medium border-b-2 transition whitespace-nowrap ${
                  isActive
                    ? 'border-blue-500 text-blue-400 font-semibold'
                    : 'border-transparent text-zinc-400 hover:text-zinc-200 hover:border-zinc-700'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{tab.label}</span>
                {tab.badge && (
                  <span className="text-[9px] bg-blue-950 text-blue-400 border border-blue-900/60 px-1.5 py-0.2 rounded font-mono">
                    {tab.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* TAB: OVERVIEW */}
        {activeTab === 'overview' && (
          <div className="space-y-6">
            {/* Quick Financial & Project Snapshot Bar */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <button
                onClick={() => setActiveTab('quotations')}
                className="p-4 rounded-xl bg-zinc-900/60 border border-zinc-800 hover:border-blue-500/50 hover:bg-zinc-800/40 text-left transition group"
              >
                <div className="flex items-center justify-between text-zinc-400 mb-1">
                  <span className="text-[11px] font-medium">Quotations</span>
                  <FileSpreadsheet className="w-3.5 h-3.5 text-blue-400 group-hover:translate-x-0.5 transition" />
                </div>
                <div className="text-lg font-bold text-white font-mono">
                  {client.linked_records?.quotations_count ?? 0}
                </div>
                <span className="text-[10px] text-blue-400">View proposals &rarr;</span>
              </button>

              <button
                onClick={() => setActiveTab('invoices')}
                className="p-4 rounded-xl bg-zinc-900/60 border border-zinc-800 hover:border-purple-500/50 hover:bg-zinc-800/40 text-left transition group"
              >
                <div className="flex items-center justify-between text-zinc-400 mb-1">
                  <span className="text-[11px] font-medium">Invoices Issued</span>
                  <Receipt className="w-3.5 h-3.5 text-purple-400 group-hover:translate-x-0.5 transition" />
                </div>
                <div className="text-lg font-bold text-white font-mono">
                  {client.linked_records?.invoices_count ?? 0}
                </div>
                <span className="text-[10px] text-purple-400">
                  {client.linked_records?.payments_count ?? 0} payments recorded &rarr;
                </span>
              </button>

              <button
                onClick={() => setActiveTab('projects')}
                className="p-4 rounded-xl bg-zinc-900/60 border border-zinc-800 hover:border-emerald-500/50 hover:bg-zinc-800/40 text-left transition group"
              >
                <div className="flex items-center justify-between text-zinc-400 mb-1">
                  <span className="text-[11px] font-medium">Active Projects</span>
                  <FolderKanban className="w-3.5 h-3.5 text-emerald-400 group-hover:translate-x-0.5 transition" />
                </div>
                <div className="text-lg font-bold text-white font-mono">
                  {client.linked_records?.projects_count ?? 0}
                </div>
                <span className="text-[10px] text-emerald-400">View deliverables &rarr;</span>
              </button>

              <button
                onClick={() => setActiveTab('calendar')}
                className="p-4 rounded-xl bg-zinc-900/60 border border-zinc-800 hover:border-amber-500/50 hover:bg-zinc-800/40 text-left transition group"
              >
                <div className="flex items-center justify-between text-zinc-400 mb-1">
                  <span className="text-[11px] font-medium">Follow-ups & Events</span>
                  <Calendar className="w-3.5 h-3.5 text-amber-400 group-hover:translate-x-0.5 transition" />
                </div>
                <div className="text-lg font-bold text-white font-mono">
                  {client.linked_records?.calendar_events_count ?? 0}
                </div>
                <span className="text-[10px] text-amber-400">Open agenda &rarr;</span>
              </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Contact & Company Details */}
            <div className="space-y-6">
              <div className="p-5 rounded-2xl bg-zinc-900/70 border border-zinc-800 space-y-4">
                <h3 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider pb-2 border-b border-zinc-800">
                  Account Details
                </h3>

                <div className="space-y-3 text-xs">
                  <div>
                    <span className="text-zinc-400 block mb-0.5">Authoritative Client ID</span>
                    <span className="font-mono font-bold text-blue-400 text-sm">
                      {client.client_id}
                    </span>
                  </div>

                  <div>
                    <span className="text-zinc-400 block mb-0.5">Contact Email</span>
                    <div className="flex items-center gap-2 text-zinc-200 font-mono">
                      <Mail className="w-3.5 h-3.5 text-zinc-400" />
                      <span>{client.email}</span>
                    </div>
                  </div>

                  <div>
                    <span className="text-zinc-400 block mb-0.5">Phone Number</span>
                    <div className="flex items-center gap-2 text-zinc-200">
                      <Phone className="w-3.5 h-3.5 text-zinc-400" />
                      <span>{client.phone || '—'}</span>
                    </div>
                  </div>

                  <div>
                    <span className="text-zinc-400 block mb-0.5">Website</span>
                    <div className="flex items-center gap-2 text-blue-400">
                      <Globe className="w-3.5 h-3.5 text-zinc-400" />
                      {client.website ? (
                        <a href={client.website} target="_blank" rel="noreferrer" className="hover:underline truncate">
                          {client.website}
                        </a>
                      ) : (
                        <span className="text-zinc-400 italic">None</span>
                      )}
                    </div>
                  </div>

                  <div>
                    <span className="text-zinc-400 block mb-0.5">Billing Address</span>
                    <div className="flex items-start gap-2 text-zinc-200">
                      <MapPin className="w-3.5 h-3.5 text-zinc-400 shrink-0 mt-0.5" />
                      <span className="whitespace-pre-wrap">{client.billing_address || 'No billing address recorded.'}</span>
                    </div>
                  </div>

                  <div>
                    <span className="text-zinc-400 block mb-0.5">Service Interests</span>
                    <span className="text-zinc-200 font-medium">
                      {client.service_interests || 'General Services'}
                    </span>
                  </div>

                  <div>
                    <span className="text-zinc-400 block mb-0.5">Assigned Team Member</span>
                    {client.assigned_team_member_details ? (
                      <div className="flex items-center gap-2 text-zinc-200">
                        <span>{client.assigned_team_member_details.full_name || client.assigned_team_member_details.email}</span>
                        <RoleBadge role={client.assigned_team_member_details.role} />
                      </div>
                    ) : (
                      <span className="text-zinc-400 italic">Unassigned</span>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Linked Converted Leads History & Notes Summary (2 Cols) */}
            <div className="lg:col-span-2 space-y-6">
              {/* Converted Leads Section */}
              <div className="p-5 rounded-2xl bg-zinc-900/70 border border-zinc-800 space-y-3">
                <div className="flex items-center justify-between pb-2 border-b border-zinc-800">
                  <h3 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider flex items-center gap-2">
                    <Layers className="w-3.5 h-3.5 text-blue-400" />
                    Original Lead & Conversion Linkage
                  </h3>
                  <span className="text-xs text-zinc-400 font-mono">
                    {client.converted_leads?.length || 0} Linked
                  </span>
                </div>

                {client.converted_leads?.length === 0 ? (
                  <p className="text-xs text-zinc-400 py-3 italic">
                    This client record was created manually (not converted from a lead).
                  </p>
                ) : (
                  <div className="space-y-2">
                    {client.converted_leads?.map((leadBrief) => (
                      <div
                        key={leadBrief.id}
                        className="p-3.5 rounded-xl bg-zinc-800/30 border border-zinc-800 flex items-center justify-between gap-4 text-xs"
                      >
                        <div>
                          <Link
                            href={`/leads/${leadBrief.id}`}
                            className="font-semibold text-zinc-200 hover:text-blue-400 flex items-center gap-1.5"
                          >
                            <span>Lead #{leadBrief.id}: {leadBrief.lead_name}</span>
                            <ExternalLink className="w-3 h-3 text-zinc-400" />
                          </Link>
                          <p className="text-zinc-400 text-[11px] mt-0.5">
                            Source: {leadBrief.lead_source} • Estimated Budget: {formatCurrency(leadBrief.estimated_budget)}
                          </p>
                        </div>
                        <div className="text-right shrink-0">
                          <span className="inline-block text-[10px] bg-emerald-950/60 text-emerald-400 border border-emerald-800/50 px-2 py-0.5 rounded font-mono">
                            Won & Converted
                          </span>
                          <span className="block text-[10px] text-zinc-400 mt-0.5">
                            {new Date(leadBrief.converted_at).toLocaleDateString()}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* General Background Notes */}
              {client.notes && (
                <div className="p-5 rounded-2xl bg-zinc-900/70 border border-zinc-800 space-y-2 text-xs">
                  <h3 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider pb-2 border-b border-zinc-800">
                    Client Background Notes
                  </h3>
                  <p className="text-zinc-200 whitespace-pre-wrap leading-relaxed">
                    {client.notes}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

        {/* TAB: NOTES */}
        {activeTab === 'notes' && (
          <div className="p-6 rounded-2xl bg-zinc-900/70 border border-zinc-800 space-y-5">
            <h3 className="text-sm font-semibold text-zinc-100">Client Communication & Notes</h3>

            <form onSubmit={handleAddNote} className="space-y-2">
              <textarea
                rows={3}
                value={noteContent}
                onChange={(e) => setNoteContent(e.target.value)}
                placeholder="Write communication note, meeting minutes or account updates..."
                className="w-full px-3 py-2 text-xs bg-zinc-950 border border-zinc-800 rounded-lg text-zinc-100 placeholder-zinc-400 focus:outline-none focus:border-blue-500 transition"
              />
              <div className="flex justify-end">
                <Button type="submit" size="sm" isLoading={isAddingNote} icon={<Send className="w-3.5 h-3.5" />}>
                  Post Note
                </Button>
              </div>
            </form>

            <div className="space-y-3 pt-3">
              {client.notes_list?.map((note) => (
                <div
                  key={note.id}
                  className="p-4 rounded-xl bg-zinc-800/40 border border-zinc-800/80 text-xs space-y-1.5"
                >
                  <div className="flex items-center justify-between text-zinc-400 text-[11px]">
                    <span className="font-semibold text-zinc-200">
                      {note.author_details?.full_name || note.author_details?.email || 'CRM User'}
                    </span>
                    <span className="font-mono text-zinc-400">
                      {new Date(note.created_at).toLocaleString()}
                    </span>
                  </div>
                  <p className="text-zinc-200 whitespace-pre-wrap">{note.content}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TAB: ACTIVITY TIMELINE */}
        {activeTab === 'activity' && (
          <div className="p-6 rounded-2xl bg-zinc-900/70 border border-zinc-800 space-y-4">
            <h3 className="text-sm font-semibold text-zinc-100">Client Account Activity History</h3>
            <div className="space-y-3">
              {client.activities_list?.map((act) => (
                <div
                  key={act.id}
                  className="flex items-start justify-between p-3.5 rounded-xl bg-zinc-800/30 border border-zinc-800 text-xs gap-3"
                >
                  <div>
                    <span className="font-semibold text-zinc-200 block">
                      {act.action_type.replace(/_/g, ' ')}
                    </span>
                    <p className="text-zinc-400 mt-0.5">{act.description}</p>
                  </div>
                  <span className="text-[11px] text-zinc-400 font-mono shrink-0">
                    {new Date(act.created_at).toLocaleString()}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TAB: QUOTATIONS */}
        {activeTab === 'quotations' && (
          <div className="p-6 rounded-2xl bg-zinc-900/70 border border-zinc-800 space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-3 border-b border-zinc-800">
              <div>
                <h3 className="text-sm font-semibold text-zinc-100 flex items-center gap-2">
                  <FileSpreadsheet className="w-4 h-4 text-blue-400" />
                  Client Quotations & Cost Proposals
                </h3>
                <p className="text-xs text-zinc-400 mt-0.5">
                  Proposals and scope estimates bound to authoritative client ID{' '}
                  <span className="font-mono text-blue-400">{client.client_id}</span>.
                </p>
              </div>
              <Link href={`/quotations?client_id=${client.id}`}>
                <Button size="sm" icon={<Plus className="w-3.5 h-3.5" />}>
                  Create Quotation
                </Button>
              </Link>
            </div>

            {!client.linked_records?.quotations || client.linked_records.quotations.length === 0 ? (
              <div className="text-center py-10 space-y-2 border border-dashed border-zinc-800 rounded-xl">
                <FileSpreadsheet className="w-8 h-8 text-zinc-600 mx-auto" />
                <p className="text-xs text-zinc-400">No quotations generated yet for this client.</p>
                <Link href={`/quotations?client_id=${client.id}`} className="inline-block mt-2">
                  <Button size="sm" variant="outline" icon={<Plus className="w-3.5 h-3.5" />}>
                    Generate First Quotation
                  </Button>
                </Link>
              </div>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-zinc-800">
                <table className="w-full text-left text-xs">
                  <thead className="bg-zinc-800/60 text-zinc-400 font-semibold uppercase text-[10px] border-b border-zinc-800">
                    <tr>
                      <th className="px-4 py-2.5">Quotation #</th>
                      <th className="px-4 py-2.5">Title</th>
                      <th className="px-4 py-2.5">Total Amount</th>
                      <th className="px-4 py-2.5">Issue Date</th>
                      <th className="px-4 py-2.5">Status</th>
                      <th className="px-4 py-2.5">Conversion</th>
                      <th className="px-4 py-2.5 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800/50">
                    {client.linked_records.quotations.map((q) => (
                      <tr key={q.id} className="hover:bg-zinc-800/30 transition">
                        <td className="px-4 py-3 font-mono font-semibold text-blue-400">
                          <Link href={`/quotations/${q.id}`} className="hover:underline">
                            {q.quotation_number}
                          </Link>
                        </td>
                        <td className="px-4 py-3 text-zinc-200 font-medium">{q.title}</td>
                        <td className="px-4 py-3 font-mono text-zinc-100 font-semibold">
                          {q.currency} {Number(q.total_amount).toLocaleString()}
                        </td>
                        <td className="px-4 py-3 text-zinc-400 font-mono text-[11px]">
                          {q.issue_date}
                        </td>
                        <td className="px-4 py-3">
                          <StatusBadge status={q.status} />
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            {q.is_converted_to_project && (
                              <span className="text-[10px] bg-emerald-950/70 text-emerald-400 border border-emerald-800/60 px-1.5 py-0.5 rounded font-mono">
                                Project
                              </span>
                            )}
                            {q.is_converted_to_invoice && (
                              <span className="text-[10px] bg-purple-950/70 text-purple-400 border border-purple-800/60 px-1.5 py-0.5 rounded font-mono">
                                Invoiced
                              </span>
                            )}
                            {!q.is_converted_to_project && !q.is_converted_to_invoice && (
                              <span className="text-[10px] text-zinc-500">—</span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <Link
                            href={`/quotations/${q.id}`}
                            className="text-xs text-blue-400 hover:text-blue-300 font-medium inline-flex items-center gap-1"
                          >
                            <span>View</span>
                            <ExternalLink className="w-3 h-3" />
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* TAB: INVOICES & PAYMENTS */}
        {activeTab === 'invoices' && (
          <div className="space-y-6">
            {/* Invoices List */}
            <div className="p-6 rounded-2xl bg-zinc-900/70 border border-zinc-800 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-3 border-b border-zinc-800">
                <div>
                  <h3 className="text-sm font-semibold text-zinc-100 flex items-center gap-2">
                    <Receipt className="w-4 h-4 text-purple-400" />
                    Client Invoices & Billing
                  </h3>
                  <p className="text-xs text-zinc-400 mt-0.5">
                    Official tax and service invoices issued to {client.name}.
                  </p>
                </div>
                <Link href={`/invoices?client_id=${client.id}`}>
                  <Button size="sm" icon={<Plus className="w-3.5 h-3.5" />}>
                    Create Invoice
                  </Button>
                </Link>
              </div>

              {!client.linked_records?.invoices || client.linked_records.invoices.length === 0 ? (
                <div className="text-center py-10 space-y-2 border border-dashed border-zinc-800 rounded-xl">
                  <Receipt className="w-8 h-8 text-zinc-600 mx-auto" />
                  <p className="text-xs text-zinc-400">No invoices issued yet for this client.</p>
                  <Link href={`/invoices?client_id=${client.id}`} className="inline-block mt-2">
                    <Button size="sm" variant="outline" icon={<Plus className="w-3.5 h-3.5" />}>
                      Create First Invoice
                    </Button>
                  </Link>
                </div>
              ) : (
                <div className="overflow-x-auto rounded-xl border border-zinc-800">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-zinc-800/60 text-zinc-400 font-semibold uppercase text-[10px] border-b border-zinc-800">
                      <tr>
                        <th className="px-4 py-2.5">Invoice #</th>
                        <th className="px-4 py-2.5">Title</th>
                        <th className="px-4 py-2.5">Total Amount</th>
                        <th className="px-4 py-2.5">Paid</th>
                        <th className="px-4 py-2.5">Balance</th>
                        <th className="px-4 py-2.5">Due Date</th>
                        <th className="px-4 py-2.5">Status</th>
                        <th className="px-4 py-2.5 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-800/50">
                      {client.linked_records.invoices.map((inv) => (
                        <tr key={inv.id} className="hover:bg-zinc-800/30 transition">
                          <td className="px-4 py-3 font-mono font-semibold text-purple-400">
                            <Link href={`/invoices/${inv.id}`} className="hover:underline">
                              {inv.invoice_number}
                            </Link>
                          </td>
                          <td className="px-4 py-3 text-zinc-200 font-medium">{inv.title}</td>
                          <td className="px-4 py-3 font-mono text-zinc-100 font-semibold">
                            {inv.currency} {Number(inv.total_amount).toLocaleString()}
                          </td>
                          <td className="px-4 py-3 font-mono text-emerald-400">
                            {inv.currency} {Number(inv.amount_paid).toLocaleString()}
                          </td>
                          <td className="px-4 py-3 font-mono text-amber-400 font-semibold">
                            {inv.currency} {Number(inv.remaining_balance).toLocaleString()}
                          </td>
                          <td className="px-4 py-3 text-zinc-400 font-mono text-[11px]">
                            {inv.due_date || '—'}
                          </td>
                          <td className="px-4 py-3">
                            <StatusBadge status={inv.status} />
                          </td>
                          <td className="px-4 py-3 text-right">
                            <Link
                              href={`/invoices/${inv.id}`}
                              className="text-xs text-purple-400 hover:text-purple-300 font-medium inline-flex items-center gap-1"
                            >
                              <span>View</span>
                              <ExternalLink className="w-3 h-3" />
                            </Link>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Received Payments Sub-card */}
            {client.linked_records?.payments && client.linked_records.payments.length > 0 && (
              <div className="p-6 rounded-2xl bg-zinc-900/70 border border-zinc-800 space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
                  <h3 className="text-sm font-semibold text-zinc-100 flex items-center gap-2">
                    <CreditCard className="w-4 h-4 text-emerald-400" />
                    Payment Receipts & Transaction Log
                  </h3>
                  <span className="text-xs text-zinc-400 font-mono">
                    {client.linked_records.payments.length} Receipt(s)
                  </span>
                </div>

                <div className="overflow-x-auto rounded-xl border border-zinc-800">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-zinc-800/60 text-zinc-400 font-semibold uppercase text-[10px] border-b border-zinc-800">
                      <tr>
                        <th className="px-4 py-2.5">Receipt #</th>
                        <th className="px-4 py-2.5">Invoice #</th>
                        <th className="px-4 py-2.5">Amount Paid</th>
                        <th className="px-4 py-2.5">Date</th>
                        <th className="px-4 py-2.5">Method</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-800/50 font-mono text-[11px]">
                      {client.linked_records.payments.map((p) => (
                        <tr key={p.id} className="hover:bg-zinc-800/30">
                          <td className="px-4 py-3 font-semibold text-emerald-400">
                            {p.receipt_number}
                          </td>
                          <td className="px-4 py-3 text-purple-400">
                            {p.invoice_number || '—'}
                          </td>
                          <td className="px-4 py-3 font-bold text-zinc-100">
                            {p.currency} {Number(p.amount).toLocaleString()}
                          </td>
                          <td className="px-4 py-3 text-zinc-400">
                            {p.payment_date}
                          </td>
                          <td className="px-4 py-3 text-zinc-300 font-sans">
                            {p.payment_method.replace(/_/g, ' ')}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB: PROJECTS & TASKS */}
        {activeTab === 'projects' && (
          <div className="p-6 rounded-2xl bg-zinc-900/70 border border-zinc-800 space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-3 border-b border-zinc-800">
              <div>
                <h3 className="text-sm font-semibold text-zinc-100 flex items-center gap-2">
                  <FolderKanban className="w-4 h-4 text-emerald-400" />
                  Client Projects & Deliverables
                </h3>
                <p className="text-xs text-zinc-400 mt-0.5">
                  Execution workspaces, milestones, and task checklists for {client.name}.
                </p>
              </div>
              <Link href={`/projects?client_id=${client.id}`}>
                <Button size="sm" icon={<Plus className="w-3.5 h-3.5" />}>
                  Create Project
                </Button>
              </Link>
            </div>

            {!client.linked_records?.projects || client.linked_records.projects.length === 0 ? (
              <div className="text-center py-10 space-y-2 border border-dashed border-zinc-800 rounded-xl">
                <FolderKanban className="w-8 h-8 text-zinc-600 mx-auto" />
                <p className="text-xs text-zinc-400">No projects started yet for this client.</p>
                <Link href={`/projects?client_id=${client.id}`} className="inline-block mt-2">
                  <Button size="sm" variant="outline" icon={<Plus className="w-3.5 h-3.5" />}>
                    Launch First Project
                  </Button>
                </Link>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {client.linked_records.projects.map((proj) => (
                  <div
                    key={proj.id}
                    className="p-4 rounded-xl bg-zinc-800/40 border border-zinc-800 hover:border-emerald-500/40 transition space-y-3"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <span className="font-mono text-[10px] text-emerald-400 bg-emerald-950/60 border border-emerald-900/50 px-1.5 py-0.5 rounded">
                          {proj.project_code}
                        </span>
                        <h4 className="font-semibold text-zinc-100 text-sm mt-1">
                          {proj.project_name}
                        </h4>
                      </div>
                      <StatusBadge status={proj.status} />
                    </div>

                    <div className="space-y-1">
                      <div className="flex items-center justify-between text-[11px] text-zinc-400">
                        <span>Milestone Progress</span>
                        <span className="font-mono font-semibold text-emerald-400">
                          {proj.progress_percentage}%
                        </span>
                      </div>
                      <div className="w-full h-1.5 bg-zinc-700/50 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-emerald-500 rounded-full transition-all duration-300"
                          style={{ width: `${proj.progress_percentage}%` }}
                        />
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-2 border-t border-zinc-800/60 text-[11px]">
                      <span className="text-zinc-400">
                        Budget: <strong className="text-zinc-200 font-mono">{proj.currency} {Number(proj.budget).toLocaleString()}</strong>
                      </span>
                      <Link
                        href={`/projects/${proj.id}`}
                        className="text-emerald-400 hover:text-emerald-300 font-medium inline-flex items-center gap-1"
                      >
                        <span>Workspace</span>
                        <ExternalLink className="w-3 h-3" />
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* TAB: CALENDAR & FOLLOW-UPS */}
        {activeTab === 'calendar' && (
          <div className="p-6 rounded-2xl bg-zinc-900/70 border border-zinc-800 space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-3 border-b border-zinc-800">
              <div>
                <h3 className="text-sm font-semibold text-zinc-100 flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-amber-400" />
                  Scheduled Follow-ups & Meetings
                </h3>
                <p className="text-xs text-zinc-400 mt-0.5">
                  Client review meetings, calls, and follow-ups.
                </p>
              </div>
              <Link href="/calendar">
                <Button size="sm" variant="outline" icon={<ExternalLink className="w-3.5 h-3.5" />}>
                  Open Full Calendar
                </Button>
              </Link>
            </div>

            {!client.linked_records?.calendar_events || client.linked_records.calendar_events.length === 0 ? (
              <div className="text-center py-10 space-y-2 border border-dashed border-zinc-800 rounded-xl">
                <Calendar className="w-8 h-8 text-zinc-600 mx-auto" />
                <p className="text-xs text-zinc-400">No calendar events or follow-ups scheduled for this client.</p>
                <Link href="/calendar" className="inline-block mt-2">
                  <Button size="sm" variant="outline">
                    Schedule Event
                  </Button>
                </Link>
              </div>
            ) : (
              <div className="space-y-2.5">
                {client.linked_records.calendar_events.map((ev) => (
                  <div
                    key={ev.id}
                    className="p-3.5 rounded-xl bg-zinc-800/40 border border-zinc-800 flex items-center justify-between gap-3 text-xs"
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-[10px] bg-amber-950/70 text-amber-300 border border-amber-800/60 px-2 py-0.5 rounded font-mono">
                        {ev.event_type}
                      </span>
                      <div>
                        <div className="font-semibold text-zinc-200">{ev.title}</div>
                        <div className="text-[11px] text-zinc-400 mt-0.5 flex items-center gap-2">
                          <Clock className="w-3 h-3 text-zinc-500" />
                          <span>{new Date(ev.start_time).toLocaleString()}</span>
                          {ev.location_or_link && (
                            <span className="text-zinc-500">• {ev.location_or_link}</span>
                          )}
                        </div>
                      </div>
                    </div>
                    <StatusBadge status={ev.status} />
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* TAB: DOCUMENTS */}
        {activeTab === 'documents' && (
          <div className="p-6 rounded-2xl bg-zinc-900/70 border border-zinc-800 space-y-4">
            <h3 className="text-sm font-semibold text-zinc-100">Client Documents & Contracts</h3>
            {client.documents_list?.length === 0 ? (
              <p className="text-xs text-zinc-400 italic py-6 text-center">
                No documents uploaded yet for this client.
              </p>
            ) : (
              <div className="space-y-2">
                {client.documents_list?.map((doc) => (
                  <div
                    key={doc.id}
                    className="flex items-center justify-between p-3 rounded-xl bg-zinc-800/40 border border-zinc-800 text-xs"
                  >
                    <div className="flex items-center gap-2.5">
                      <FileText className="w-4 h-4 text-zinc-400" />
                      <span className="font-medium text-zinc-200">{doc.title}</span>
                    </div>
                    {doc.file_url && (
                      <a href={doc.file_url} target="_blank" rel="noreferrer" className="text-blue-400 hover:underline">
                        Download
                      </a>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Edit Client Modal */}
      <Modal
        isOpen={isEditOpen}
        onClose={() => setIsEditOpen(false)}
        title="Edit Client Profile"
        maxWidth="lg"
      >
        <form onSubmit={handleSaveEdit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-zinc-300 mb-1">Primary Name</label>
              <input
                type="text"
                required
                value={editData.name || ''}
                onChange={(e) => setEditData({ ...editData, name: e.target.value })}
                className="w-full px-3 py-1.5 text-xs bg-zinc-950 border border-zinc-800 rounded-lg text-zinc-100"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-300 mb-1">Company</label>
              <input
                type="text"
                value={editData.company_name || ''}
                onChange={(e) => setEditData({ ...editData, company_name: e.target.value })}
                className="w-full px-3 py-1.5 text-xs bg-zinc-950 border border-zinc-800 rounded-lg text-zinc-100"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-zinc-300 mb-1">Phone</label>
              <input
                type="text"
                value={editData.phone || ''}
                onChange={(e) => setEditData({ ...editData, phone: e.target.value })}
                className="w-full px-3 py-1.5 text-xs bg-zinc-950 border border-zinc-800 rounded-lg text-zinc-100"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-300 mb-1">Website</label>
              <input
                type="text"
                value={editData.website || ''}
                onChange={(e) => setEditData({ ...editData, website: e.target.value })}
                className="w-full px-3 py-1.5 text-xs bg-zinc-950 border border-zinc-800 rounded-lg text-zinc-100"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-zinc-300 mb-1">Billing Address</label>
            <textarea
              rows={2}
              value={editData.billing_address || ''}
              onChange={(e) => setEditData({ ...editData, billing_address: e.target.value })}
              className="w-full px-3 py-2 text-xs bg-zinc-950 border border-zinc-800 rounded-lg text-zinc-100"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-zinc-300 mb-1">Status</label>
              <select
                value={editData.client_status || 'Active'}
                onChange={(e) => setEditData({ ...editData, client_status: e.target.value as any })}
                className="w-full px-3 py-1.5 text-xs bg-zinc-950 border border-zinc-800 rounded-lg text-zinc-300"
              >
                <option value="Active">Active</option>
                <option value="Lead_Converted">Lead Converted</option>
                <option value="Inactive">Inactive</option>
                <option value="Archived">Archived</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-300 mb-1">Assigned Team Member</label>
              <select
                value={editData.assigned_team_member || ''}
                onChange={(e) => setEditData({ ...editData, assigned_team_member: e.target.value ? Number(e.target.value) : null })}
                className="w-full px-3 py-1.5 text-xs bg-zinc-950 border border-zinc-800 rounded-lg text-zinc-300"
              >
                <option value="">Unassigned</option>
                {teamMembers.map((tm) => (
                  <option key={tm.id} value={tm.id}>
                    {tm.full_name || tm.email}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-zinc-800">
            <Button type="button" variant="outline" size="sm" onClick={() => setIsEditOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" size="sm" isLoading={isSavingEdit}>
              Save Profile
            </Button>
          </div>
        </form>
      </Modal>
    </AppLayout>
  );
}
