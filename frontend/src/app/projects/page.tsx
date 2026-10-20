'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/Button';
import ClientSelector from '@/components/ui/ClientSelector';
import { api } from '@/lib/api';
import { Project, ProjectStatus, Client, User } from '@/types/crm';
import {
  FolderKanban,
  Plus,
  Search,
  Filter,
  ArrowRight,
  Clock,
  CheckCircle2,
  AlertCircle,
  PauseCircle,
  XCircle,
  UserCheck,
  Building,
} from 'lucide-react';

export default function ProjectsPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [teamMembers, setTeamMembers] = useState<User[]>([]);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState('');

  // Form Fields
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [projectName, setProjectName] = useState('');
  const [description, setDescription] = useState('');
  const [projectManager, setProjectManager] = useState<number | ''>('');
  const [budget, setBudget] = useState('500000');
  const [currency, setCurrency] = useState('PKR');
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [dueDate, setDueDate] = useState(
    new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  );

  const loadProjects = async () => {
    setIsLoading(true);
    try {
      const params: Record<string, string> = {};
      if (search) params.search = search;
      if (statusFilter !== 'all') params.status = statusFilter;

      const res = await api.getProjects(params);
      setProjects(Array.isArray(res) ? res : res.results || []);
    } catch (err) {
      console.error('Failed to load projects:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadProjects();
  }, [search, statusFilter]);

  useEffect(() => {
    api.getTeam().then((res) => {
      setTeamMembers(Array.isArray(res) ? res : res.results || []);
    }).catch(console.error);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedClient) {
      setFormError('Please select a client from the central database.');
      return;
    }
    if (!projectName.trim()) {
      setFormError('Project name is required.');
      return;
    }

    setIsSubmitting(true);
    setFormError('');

    try {
      await api.createProject({
        client: selectedClient.id,
        project_name: projectName,
        description,
        project_manager: projectManager ? Number(projectManager) : null,
        budget: parseFloat(budget) || 0,
        currency,
        start_date: startDate,
        due_date: dueDate,
      });

      setIsModalOpen(false);
      setSelectedClient(null);
      setProjectName('');
      setDescription('');
      loadProjects();
    } catch (err: unknown) {
      setFormError((err as Error).message || 'Failed to create project');
    } finally {
      setIsSubmitting(false);
    }
  };

  const getStatusBadge = (status: ProjectStatus) => {
    const styles: Record<ProjectStatus, { bg: string; text: string; icon: React.ReactNode }> = {
      Planning: { bg: 'bg-zinc-800 text-zinc-300 border-zinc-700', text: 'Planning', icon: <Clock className="w-3 h-3" /> },
      'In Progress': { bg: 'bg-blue-950/40 text-blue-400 border-blue-800/40', text: 'In Progress', icon: <Clock className="w-3 h-3" /> },
      'On Hold': { bg: 'bg-amber-950/40 text-amber-400 border-amber-800/40', text: 'On Hold', icon: <PauseCircle className="w-3 h-3" /> },
      Completed: { bg: 'bg-emerald-950/40 text-emerald-400 border-emerald-800/40', text: 'Completed', icon: <CheckCircle2 className="w-3 h-3" /> },
      Cancelled: { bg: 'bg-zinc-900 text-zinc-400 border-zinc-800', text: 'Cancelled', icon: <XCircle className="w-3 h-3" /> },
    };
    const s = styles[status] || styles.Planning;
    return (
      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${s.bg}`}>
        {s.icon}
        {s.text}
      </span>
    );
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Top Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2.5">
              <FolderKanban className="w-7 h-7 text-indigo-400" />
              Project & Task Operations
            </h1>
            <p className="text-sm text-zinc-400 mt-1">
              Deliverable milestones, developer tasks, checklists, and timelines linked to central client accounts.
            </p>
          </div>
          <Button
            onClick={() => {
              setFormError('');
              setIsModalOpen(true);
            }}
            icon={<Plus className="w-4 h-4" />}
            className="shadow-lg shadow-indigo-600/20 bg-indigo-600 hover:bg-indigo-500"
          >
            Create Project
          </Button>
        </div>

        {/* Filters */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3.5 bg-zinc-950/60 rounded-xl border border-zinc-800/80">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search project code, name, client..."
              className="w-full pl-9 pr-3 py-2 text-xs sm:text-sm bg-zinc-900 border border-zinc-800 rounded-lg text-zinc-200 focus:outline-none focus:border-indigo-500"
            />
          </div>

          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-zinc-400 shrink-0" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full px-3 py-2 text-xs sm:text-sm bg-zinc-900 border border-zinc-800 rounded-lg text-zinc-200 focus:outline-none focus:border-indigo-500"
            >
              <option value="all">All Statuses</option>
              <option value="Planning">Planning</option>
              <option value="In Progress">In Progress</option>
              <option value="On Hold">On Hold</option>
              <option value="Completed">Completed</option>
              <option value="Cancelled">Cancelled</option>
            </select>
          </div>
        </div>

        {/* Projects Grid */}
        {isLoading ? (
          <div className="p-12 text-center text-zinc-400 bg-zinc-950/60 rounded-2xl border border-zinc-800">
            <div className="w-7 h-7 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
            <p>Loading projects...</p>
          </div>
        ) : projects.length === 0 ? (
          <div className="p-12 text-center text-zinc-400 bg-zinc-950/60 rounded-2xl border border-zinc-800">
            <FolderKanban className="w-10 h-10 mx-auto text-zinc-400 mb-2" />
            <p className="text-base font-semibold text-zinc-200">No projects found</p>
            <p className="text-xs text-zinc-400 mt-1">
              Create a new project or convert an accepted quotation to initialize a project automatically.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {projects.map((prj) => (
              <div
                key={prj.id}
                className="p-5 bg-zinc-950/80 border border-zinc-800/80 hover:border-indigo-500/50 rounded-2xl transition shadow-lg flex flex-col justify-between group"
              >
                <div>
                  <div className="flex items-center justify-between gap-2 pb-3 border-b border-zinc-800/80">
                    <span className="font-mono text-xs font-bold text-indigo-400 px-2 py-0.5 rounded bg-indigo-500/10 border border-indigo-500/20">
                      {prj.project_code}
                    </span>
                    {getStatusBadge(prj.status)}
                  </div>

                  <h3 className="font-bold text-base text-zinc-100 mt-3 group-hover:text-indigo-300 transition line-clamp-1">
                    <Link href={`/projects/${prj.id}`}>{prj.project_name}</Link>
                  </h3>

                  <div className="mt-2 text-xs text-zinc-400 flex items-center gap-1.5">
                    <Building className="w-3.5 h-3.5 text-zinc-500" />
                    <Link
                      href={`/clients/${prj.client}`}
                      className="hover:text-indigo-400 transition truncate"
                    >
                      {prj.client_details?.name} ({prj.client_details?.client_id})
                    </Link>
                  </div>

                  {/* Progress bar */}
                  <div className="mt-4">
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="text-zinc-400">Progress</span>
                      <span className="font-mono font-semibold text-zinc-200">{prj.progress_percentage}%</span>
                    </div>
                    <div className="w-full h-2 bg-zinc-900 rounded-full overflow-hidden border border-zinc-800">
                      <div
                        className="h-full bg-gradient-to-r from-blue-600 to-indigo-500 transition-all duration-500 rounded-full"
                        style={{ width: `${Math.min(100, Math.max(0, prj.progress_percentage))}%` }}
                      />
                    </div>
                  </div>

                  {/* Metadata */}
                  <div className="grid grid-cols-2 gap-2 mt-4 pt-3 border-t border-zinc-800/60 text-xs text-zinc-400">
                    <div>
                      <span className="text-zinc-500 block">Budget:</span>
                      <span className="font-mono font-semibold text-zinc-200">
                        {Number(prj.budget).toLocaleString()} {prj.currency}
                      </span>
                    </div>
                    <div>
                      <span className="text-zinc-500 block">Due Date:</span>
                      <span className="font-mono text-zinc-300">{prj.due_date || 'N/A'}</span>
                    </div>
                  </div>
                </div>

                <div className="pt-4 mt-3 border-t border-zinc-800/80 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-1.5 text-zinc-400">
                    <UserCheck className="w-3.5 h-3.5 text-zinc-500" />
                    <span>{prj.project_manager_details?.full_name || 'PM Unassigned'}</span>
                  </div>
                  <Link
                    href={`/projects/${prj.id}`}
                    className="text-indigo-400 hover:text-indigo-300 font-semibold flex items-center gap-1 group-hover:translate-x-0.5 transition"
                  >
                    <span>Manage</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Create Project Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm overflow-y-auto">
          <div className="relative w-full max-w-2xl bg-zinc-950 border border-zinc-800 rounded-2xl p-6 shadow-2xl my-8">
            <div className="flex items-center justify-between pb-4 border-b border-zinc-800">
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <FolderKanban className="w-5 h-5 text-indigo-400" />
                Initialize New Project
              </h2>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1.5 text-zinc-400 hover:text-white rounded-lg hover:bg-zinc-900"
              >
                ✕
              </button>
            </div>

            {formError && (
              <div className="mt-3 p-3 bg-red-950/40 border border-red-800/60 rounded-xl text-red-300 text-xs">
                {formError}
              </div>
            )}

            <form onSubmit={handleSubmit} className="mt-4 space-y-4">
              <ClientSelector
                selectedClientId={selectedClient?.id}
                onSelectClient={(c) => setSelectedClient(c)}
                required
                label="Central Client *"
              />

              <div>
                <label className="block text-xs font-semibold text-zinc-300 uppercase tracking-wider mb-1">
                  Project Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Next.js SaaS Platform Redesign"
                  value={projectName}
                  onChange={(e) => setProjectName(e.target.value)}
                  className="w-full px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-xl text-zinc-100 text-sm focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-300 uppercase tracking-wider mb-1">
                  Project Description / Scope
                </label>
                <textarea
                  rows={3}
                  placeholder="Overview of deliverables and objectives"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-xl text-zinc-100 text-xs focus:outline-none focus:border-indigo-500 font-sans"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-zinc-300 uppercase tracking-wider mb-1">
                    Project Manager
                  </label>
                  <select
                    value={projectManager}
                    onChange={(e) => setProjectManager(e.target.value ? Number(e.target.value) : '')}
                    className="w-full px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-xl text-zinc-100 text-xs focus:outline-none focus:border-indigo-500"
                  >
                    <option value="">Unassigned</option>
                    {teamMembers.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.full_name || m.email} ({m.role})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-xs font-semibold text-zinc-300 uppercase tracking-wider mb-1">
                      Budget
                    </label>
                    <input
                      type="number"
                      value={budget}
                      onChange={(e) => setBudget(e.target.value)}
                      className="w-full px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-xl text-zinc-100 text-xs focus:outline-none focus:border-indigo-500 font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-zinc-300 uppercase tracking-wider mb-1">
                      Currency
                    </label>
                    <select
                      value={currency}
                      onChange={(e) => setCurrency(e.target.value)}
                      className="w-full px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-xl text-zinc-100 text-xs focus:outline-none focus:border-indigo-500"
                    >
                      <option value="PKR">PKR</option>
                      <option value="USD">USD</option>
                      <option value="GBP">GBP</option>
                      <option value="EUR">EUR</option>
                      <option value="AED">AED</option>
                      <option value="SAR">SAR</option>
                      <option value="CAD">CAD</option>
                    </select>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-zinc-300 uppercase tracking-wider mb-1">
                    Start Date *
                  </label>
                  <input
                    type="date"
                    required
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-xl text-zinc-100 text-xs focus:outline-none focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-zinc-300 uppercase tracking-wider mb-1">
                    Due Date
                  </label>
                  <input
                    type="date"
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                    className="w-full px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-xl text-zinc-100 text-xs focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-zinc-800">
                <Button type="button" variant="outline" size="sm" onClick={() => setIsModalOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" size="sm" disabled={isSubmitting} className="bg-indigo-600 hover:bg-indigo-500">
                  {isSubmitting ? 'Creating Project...' : 'Create Project'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </AppLayout>
  );
}
