'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useParams } from 'next/navigation';
import { AppLayout } from '@/components/layout/AppLayout';
import { StatusBadge, PriorityBadge, RoleBadge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { ConvertLeadModal } from '@/components/leads/ConvertLeadModal';
import { useCompany } from '@/context/CompanyContext';
import { useAuth } from '@/context/AuthContext';
import { api } from '@/lib/api';
import { Lead, LeadStatus, LeadPriority, Client, User, CompanyService } from '@/types/crm';
import {
  ArrowLeft,
  Building,
  Mail,
  Phone,
  Globe,
  DollarSign,
  Calendar,
  UserCheck,
  CheckCircle2,
  Clock,
  Send,
  MessageSquare,
  Activity,
  Edit,
  ExternalLink,
  Shield,
  Layers,
} from 'lucide-react';

export default function LeadDetailPage() {
  const router = useRouter();
  const routeParams = useParams();
  const id = (routeParams?.id as string) || '';

  const { formatCurrency, currency } = useCompany();
  const { user } = useAuth();

  const [lead, setLead] = useState<Lead | null>(null);
  const [teamMembers, setTeamMembers] = useState<User[]>([]);
  const [services, setServices] = useState<CompanyService[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Note form state
  const [noteContent, setNoteContent] = useState('');
  const [isAddingNote, setIsAddingNote] = useState(false);

  // Conversion Modal state
  const [isConvertOpen, setIsConvertOpen] = useState(false);

  // Edit Lead Modal state
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editData, setEditData] = useState<Partial<Lead>>({});
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  const loadLead = async () => {
    if (!id) return;
    try {
      const data = await api.getLead(Number(id));
      setLead(data);
      setEditData({
        lead_name: data.lead_name,
        company: data.company,
        email: data.email,
        phone: data.phone,
        website: data.website,
        interested_service: data.interested_service,
        estimated_budget: data.estimated_budget,
        status: data.status,
        priority: data.priority,
        next_follow_up_date: data.next_follow_up_date,
        assigned_salesperson: data.assigned_salesperson,
      });
    } catch (err) {
      console.error('Failed to load lead details', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadLead();
    api.getTeam().then((res) => {
      setTeamMembers(Array.isArray(res) ? res : res.results || []);
    });
    api.getServices({ active_only: true }).then((res) => {
      setServices(Array.isArray(res) ? res : (res as { results?: CompanyService[] })?.results || []);
    }).catch(console.error);
  }, [id]);

  const handleStatusChange = async (newStatus: LeadStatus) => {
    if (!lead) return;
    try {
      const updated = await api.updateLead(lead.id, { status: newStatus });
      setLead({ ...lead, status: updated.status });
      loadLead();
    } catch (err) {
      console.error('Failed to update lead status', err);
    }
  };

  const handleAddNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!noteContent.trim() || !lead) return;

    setIsAddingNote(true);
    try {
      await api.addLeadNote(lead.id, noteContent.trim());
      setNoteContent('');
      loadLead();
    } catch (err) {
      console.error('Failed to add note', err);
    } finally {
      setIsAddingNote(false);
    }
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!lead) return;

    setIsSavingEdit(true);
    try {
      await api.updateLead(lead.id, editData);
      setIsEditOpen(false);
      loadLead();
    } catch (err) {
      console.error('Failed to update lead', err);
    } finally {
      setIsSavingEdit(false);
    }
  };

  const canConvert =
    user?.role === 'Administrator' ||
    user?.role === 'Sales Manager' ||
    (user?.role === 'Salesperson' &&
      (lead?.assigned_salesperson === user?.id || !lead?.assigned_salesperson));

  if (isLoading) {
    return (
      <AppLayout>
        <div className="p-12 text-center text-xs text-zinc-400">Loading lead details...</div>
      </AppLayout>
    );
  }

  if (!lead) {
    return (
      <AppLayout>
        <div className="p-12 text-center">
          <p className="text-zinc-400 text-sm">Lead record not found.</p>
          <Link href="/leads" className="text-blue-400 text-xs hover:underline mt-2 inline-block">
            Back to Leads
          </Link>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Back Link & Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-zinc-800">
          <div className="flex items-center gap-3">
            <Link
              href="/leads"
              className="p-2 rounded-lg bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 text-zinc-400 hover:text-zinc-100 transition"
            >
              <ArrowLeft className="w-4 h-4" />
            </Link>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
                  {lead.lead_name}
                </h1>
                <StatusBadge status={lead.status} />
                <PriorityBadge priority={lead.priority} />
              </div>
              <p className="text-xs text-zinc-400 mt-0.5">
                {lead.company ? `${lead.company} • ` : ''}Added on{' '}
                {new Date(lead.created_at).toLocaleDateString()}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsEditOpen(true)}
              icon={<Edit className="w-3.5 h-3.5" />}
            >
              Edit Lead
            </Button>

            {/* Prominent Convert to Client Button */}
            {lead.converted_client ? (
              <Link href={`/clients/${lead.converted_client}`}>
                <Button
                  variant="success"
                  size="sm"
                  icon={<CheckCircle2 className="w-4 h-4" />}
                >
                  View Client Profile ({lead.converted_client_details?.client_id || 'CLI'})
                </Button>
              </Link>
            ) : canConvert ? (
              <Button
                variant="success"
                size="md"
                onClick={() => setIsConvertOpen(true)}
                icon={<UserCheck className="w-4 h-4" />}
                className="shadow-lg shadow-emerald-600/20"
              >
                Convert to Client
              </Button>
            ) : null}
          </div>
        </div>

        {/* If converted, show prominent celebration banner */}
        {lead.converted_client && (
          <div className="p-4 rounded-xl bg-emerald-950/40 border border-emerald-800/60 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
              <div>
                <p className="text-xs font-semibold text-emerald-200">
                  This lead has been successfully converted into an authoritative Client record!
                </p>
                <p className="text-[11px] text-emerald-300/70 mt-0.5">
                  Linked Client ID:{' '}
                  <span className="font-mono font-bold text-white">
                    {lead.converted_client_details?.client_id || lead.converted_client}
                  </span>{' '}
                  • Converted at {new Date(lead.converted_at || lead.updated_at).toLocaleString()}
                </p>
              </div>
            </div>
            <Link href={`/clients/${lead.converted_client}`}>
              <Button size="sm" variant="outline" className="border-emerald-800 text-emerald-300">
                Open Client File
              </Button>
            </Link>
          </div>
        )}

        {/* Status Pipeline Step Indicator */}
        <div className="p-4 rounded-xl bg-zinc-900/80 border border-zinc-800 space-y-2">
          <span className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider block">
            Lead Qualification Stage
          </span>
          <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
            {(['New', 'Contacted', 'Qualified', 'Proposal', 'Won', 'Lost'] as LeadStatus[]).map(
              (step) => {
                const isCurrent = lead.status === step;
                return (
                  <button
                    key={step}
                    type="button"
                    onClick={() => handleStatusChange(step)}
                    className={`py-2 px-2.5 rounded-lg text-xs font-medium transition text-center border ${
                      isCurrent
                        ? 'bg-blue-600 text-white border-blue-500 shadow-md shadow-blue-600/20'
                        : 'bg-zinc-800/50 text-zinc-400 border-zinc-700/60 hover:text-zinc-200 hover:bg-zinc-800'
                    }`}
                  >
                    {step}
                  </button>
                );
              }
            )}
          </div>
        </div>

        {/* Main Details & Notes Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column: Lead Info & Metrics (1 Col) */}
          <div className="space-y-6">
            {/* Contact Details Card */}
            <div className="p-5 rounded-2xl bg-zinc-900/70 border border-zinc-800 space-y-4">
              <h3 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider pb-2 border-b border-zinc-800">
                Contact & Details
              </h3>

              <div className="space-y-3 text-xs">
                <div>
                  <span className="text-zinc-400 block mb-0.5">Email</span>
                  <div className="flex items-center gap-2 text-zinc-200 font-mono">
                    <Mail className="w-3.5 h-3.5 text-zinc-400" />
                    <span>{lead.email}</span>
                  </div>
                </div>

                <div>
                  <span className="text-zinc-400 block mb-0.5">Phone</span>
                  <div className="flex items-center gap-2 text-zinc-200">
                    <Phone className="w-3.5 h-3.5 text-zinc-400" />
                    <span>{lead.phone || '—'}</span>
                  </div>
                </div>

                <div>
                  <span className="text-zinc-400 block mb-0.5">Company</span>
                  <div className="flex items-center gap-2 text-zinc-200">
                    <Building className="w-3.5 h-3.5 text-zinc-400" />
                    <span>{lead.company || '—'}</span>
                  </div>
                </div>

                <div>
                  <span className="text-zinc-400 block mb-0.5">Website</span>
                  <div className="flex items-center gap-2 text-blue-400">
                    <Globe className="w-3.5 h-3.5 text-zinc-400" />
                    {lead.website ? (
                      <a href={lead.website} target="_blank" rel="noreferrer" className="hover:underline truncate">
                        {lead.website}
                      </a>
                    ) : (
                      <span className="text-zinc-400 italic">None</span>
                    )}
                  </div>
                </div>

                <div>
                  <span className="text-zinc-400 block mb-0.5">Interested Service</span>
                  <span className="text-zinc-200 font-medium">
                    {lead.interested_service || 'General Inquiries'}
                  </span>
                </div>

                <div>
                  <span className="text-zinc-400 block mb-0.5">Estimated Budget</span>
                  <span className="text-zinc-100 font-bold text-sm">
                    {formatCurrency(lead.estimated_budget)}
                  </span>
                </div>

                <div>
                  <span className="text-zinc-400 block mb-0.5">Lead Source</span>
                  <span className="text-zinc-200">{lead.lead_source}</span>
                </div>

                <div>
                  <span className="text-zinc-400 block mb-0.5">Next Follow-Up Date</span>
                  <div className="flex items-center gap-2 font-mono text-amber-400">
                    <Calendar className="w-3.5 h-3.5" />
                    <span>{lead.next_follow_up_date || 'Not scheduled'}</span>
                  </div>
                </div>

                <div>
                  <span className="text-zinc-400 block mb-0.5">Assigned Salesperson</span>
                  {lead.assigned_salesperson_details ? (
                    <div className="flex items-center gap-2 text-zinc-200">
                      <span>{lead.assigned_salesperson_details.full_name || lead.assigned_salesperson_details.email}</span>
                      <RoleBadge role={lead.assigned_salesperson_details.role} />
                    </div>
                  ) : (
                    <span className="text-zinc-400 italic">Unassigned</span>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Right Column: Communication Notes & Activity History (2 Cols) */}
          <div className="lg:col-span-2 space-y-6">
            {/* Notes Section */}
            <div className="p-5 rounded-2xl bg-zinc-900/70 border border-zinc-800 space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
                <div className="flex items-center gap-2">
                  <MessageSquare className="w-4 h-4 text-blue-400" />
                  <h3 className="text-xs font-semibold text-zinc-100 uppercase tracking-wider">
                    Discovery Notes & Communication History
                  </h3>
                </div>
                <span className="text-xs text-zinc-400 font-mono">
                  {lead.notes_list?.length || 0} Notes
                </span>
              </div>

              {/* Add Note Form */}
              <form onSubmit={handleAddNote} className="space-y-2">
                <textarea
                  rows={2}
                  value={noteContent}
                  onChange={(e) => setNoteContent(e.target.value)}
                  placeholder="Record call summary, client feedback, or proposal requirements..."
                  className="w-full px-3 py-2 text-xs bg-zinc-950 border border-zinc-800 rounded-lg text-zinc-100 placeholder-zinc-400 focus:outline-none focus:border-blue-500 transition"
                />
                <div className="flex justify-end">
                  <Button
                    type="submit"
                    size="sm"
                    isLoading={isAddingNote}
                    icon={<Send className="w-3.5 h-3.5" />}
                  >
                    Add Note
                  </Button>
                </div>
              </form>

              {/* Notes Timeline */}
              <div className="space-y-3 pt-2">
                {lead.notes && (
                  <div className="p-3.5 rounded-xl bg-zinc-800/30 border border-zinc-800 text-xs space-y-1">
                    <span className="text-[11px] font-semibold text-zinc-400 block uppercase">
                      Initial Notes
                    </span>
                    <p className="text-zinc-200 whitespace-pre-wrap">{lead.notes}</p>
                  </div>
                )}

                {lead.notes_list?.map((note) => (
                  <div
                    key={note.id}
                    className="p-3.5 rounded-xl bg-zinc-800/40 border border-zinc-800/70 text-xs space-y-1.5"
                  >
                    <div className="flex items-center justify-between text-zinc-400 text-[11px]">
                      <span className="font-medium text-zinc-200">
                        {note.author_details?.full_name || note.author_details?.email || 'Team Member'}
                      </span>
                      <span className="font-mono">
                        {new Date(note.created_at).toLocaleString()}
                      </span>
                    </div>
                    <p className="text-zinc-200 whitespace-pre-wrap">{note.content}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Activity History */}
            <div className="p-5 rounded-2xl bg-zinc-900/70 border border-zinc-800 space-y-4">
              <div className="flex items-center gap-2 pb-3 border-b border-zinc-800">
                <Activity className="w-4 h-4 text-emerald-400" />
                <h3 className="text-xs font-semibold text-zinc-100 uppercase tracking-wider">
                  Lead Activity Timeline
                </h3>
              </div>

              <div className="space-y-2.5">
                {lead.activities_list?.map((act) => (
                  <div
                    key={act.id}
                    className="flex items-start justify-between p-3 rounded-xl bg-zinc-800/30 border border-zinc-800/60 text-xs gap-3"
                  >
                    <div>
                      <span className="font-semibold text-zinc-200 block">
                        {act.action.replace(/_/g, ' ')}
                      </span>
                      <p className="text-zinc-400 mt-0.5">{act.description}</p>
                    </div>
                    <span className="text-[11px] text-zinc-400 font-mono shrink-0">
                      {new Date(act.created_at).toLocaleDateString()}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Convert Lead Modal */}
      {isConvertOpen && (
        <ConvertLeadModal
          lead={lead}
          isOpen={isConvertOpen}
          onClose={() => setIsConvertOpen(false)}
          onSuccess={(client) => {
            setIsConvertOpen(false);
            loadLead();
          }}
        />
      )}

      {/* Edit Lead Modal */}
      <Modal
        isOpen={isEditOpen}
        onClose={() => setIsEditOpen(false)}
        title="Edit Lead Information"
        maxWidth="lg"
      >
        <form onSubmit={handleSaveEdit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-zinc-300 mb-1">Lead Name</label>
              <input
                type="text"
                required
                value={editData.lead_name || ''}
                onChange={(e) => setEditData({ ...editData, lead_name: e.target.value })}
                className="w-full px-3 py-1.5 text-xs bg-zinc-950 border border-zinc-800 rounded-lg text-zinc-100"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-300 mb-1">Company</label>
              <input
                type="text"
                value={editData.company || ''}
                onChange={(e) => setEditData({ ...editData, company: e.target.value })}
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
            <label className="block text-xs font-medium text-zinc-300 mb-1">Interested Service</label>
            <select
              value={editData.interested_service || ''}
              onChange={(e) => setEditData({ ...editData, interested_service: e.target.value })}
              className="w-full px-3 py-1.5 text-xs bg-zinc-950 border border-zinc-800 rounded-lg text-zinc-100 focus:outline-none focus:border-blue-500 transition"
            >
              <option value="">Select a service...</option>
              {editData.interested_service && !services.some((s) => s.name === editData.interested_service) && (
                <option value={editData.interested_service}>{editData.interested_service}</option>
              )}
              {services.map((svc) => (
                <option key={svc.id} value={svc.name}>
                  {svc.name}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium text-zinc-300 mb-1">Budget ({currency})</label>
              <input
                type="number"
                value={editData.estimated_budget || ''}
                onChange={(e) => setEditData({ ...editData, estimated_budget: e.target.value })}
                className="w-full px-3 py-1.5 text-xs bg-zinc-950 border border-zinc-800 rounded-lg text-zinc-100"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-300 mb-1">Priority</label>
              <select
                value={editData.priority || 'Medium'}
                onChange={(e) => setEditData({ ...editData, priority: e.target.value as LeadPriority })}
                className="w-full px-3 py-1.5 text-xs bg-zinc-950 border border-zinc-800 rounded-lg text-zinc-300"
              >
                <option value="Low">Low</option>
                <option value="Medium">Medium</option>
                <option value="High">High</option>
                <option value="Urgent">Urgent</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-300 mb-1">Assigned Sales</label>
              <select
                value={editData.assigned_salesperson || ''}
                onChange={(e) => setEditData({ ...editData, assigned_salesperson: e.target.value ? Number(e.target.value) : null })}
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
              Save Changes
            </Button>
          </div>
        </form>
      </Modal>
    </AppLayout>
  );
}
