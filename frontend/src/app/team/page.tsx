'use client';

import React, { useEffect, useState } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { RoleBadge, Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { EmptyState } from '@/components/ui/StatCard';
import { useAuth } from '@/context/AuthContext';
import { api } from '@/lib/api';
import { User, UserRole } from '@/types/crm';
import {
  UserCheck,
  Plus,
  Shield,
  Search,
  CheckCircle2,
  XCircle,
  Mail,
  Phone,
  Power,
  Edit,
  ShieldCheck,
  Key,
  Users,
} from 'lucide-react';

export default function TeamPage() {
  const { user: currentUser, isAdmin } = useAuth();
  const [team, setTeam] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');

  // Invite/Create Member Modal
  const [isInviteOpen, setIsInviteOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const [newMember, setNewMember] = useState({
    email: '',
    username: '',
    first_name: '',
    last_name: '',
    role: 'Salesperson' as UserRole,
    phone: '',
    password: '',
  });

  // Edit Role Modal
  const [editUser, setEditUser] = useState<User | null>(null);
  const [editRole, setEditRole] = useState<UserRole>('Salesperson');
  const [isUpdatingRole, setIsUpdatingRole] = useState(false);

  const loadTeam = async () => {
    setIsLoading(true);
    try {
      const params: Record<string, string> = {};
      if (search) params.search = search;
      if (roleFilter) params.role = roleFilter;

      const res = await api.getTeam(params);
      setTeam(Array.isArray(res) ? res : res.results || []);
    } catch (err) {
      console.error('Failed to load team', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadTeam();
  }, [search, roleFilter]);

  const handleCreateMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMember.email) {
      setFormError('Email address is required.');
      return;
    }

    setIsSubmitting(true);
    setFormError(null);

    try {
      await api.createTeamMember(newMember);
      setIsInviteOpen(false);
      setNewMember({
        email: '',
        username: '',
        first_name: '',
        last_name: '',
        role: 'Salesperson',
        phone: '',
        password: '',
      });
      loadTeam();
    } catch (err: unknown) {
      const apiErr = err as { data?: { email?: string[]; detail?: string }; message?: string };
      setFormError(
        apiErr.data?.email?.[0] || apiErr.data?.detail || apiErr.message || 'Failed to create team member.'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleActive = async (targetUser: User) => {
    if (targetUser.id === currentUser?.id) {
      alert('You cannot deactivate your own account.');
      return;
    }
    const action = targetUser.is_active ? 'deactivate' : 'activate';
    if (!confirm(`Are you sure you want to ${action} ${targetUser.email}?`)) return;

    try {
      await api.toggleTeamActive(targetUser.id);
      loadTeam();
    } catch (err) {
      alert((err as Error).message || `Failed to ${action} user.`);
    }
  };

  const handleUpdateRole = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editUser) return;

    setIsUpdatingRole(true);
    try {
      await api.updateTeamMember(editUser.id, { role: editRole });
      setEditUser(null);
      loadTeam();
    } catch (err) {
      alert((err as Error).message || 'Failed to update role.');
    } finally {
      setIsUpdatingRole(false);
    }
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
              Team & Permissions
            </h1>
            <p className="text-xs sm:text-sm text-zinc-400 mt-1">
              Manage Roo4Tech team members, role assignments, and system access rights.
            </p>
          </div>

          {isAdmin && (
            <Button
              onClick={() => setIsInviteOpen(true)}
              icon={<Plus className="w-4 h-4" />}
              size="md"
            >
              Invite Team Member
            </Button>
          )}
        </div>

        {/* Roles Breakdown Card */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          {[
            { role: 'Administrator', count: team.filter((t) => t.role === 'Administrator').length, color: 'text-rose-400' },
            { role: 'Sales Manager', count: team.filter((t) => t.role === 'Sales Manager').length, color: 'text-purple-400' },
            { role: 'Salesperson', count: team.filter((t) => t.role === 'Salesperson').length, color: 'text-blue-400' },
            { role: 'Developer', count: team.filter((t) => t.role === 'Developer').length, color: 'text-cyan-400' },
            { role: 'Video Editor', count: team.filter((t) => t.role === 'Video Editor').length, color: 'text-amber-400' },
          ].map((item) => (
            <div
              key={item.role}
              className="p-3.5 rounded-xl bg-zinc-900/60 border border-zinc-800 text-center space-y-1"
            >
              <span className={`text-xl font-bold block ${item.color}`}>{item.count}</span>
              <span className="text-[11px] text-zinc-400 uppercase font-medium">{item.role}</span>
            </div>
          ))}
        </div>

        {/* Filters */}
        <div className="p-4 rounded-xl bg-zinc-900/80 border border-zinc-800 flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search team members by name, email or phone..."
              className="w-full pl-9 pr-3 py-1.5 text-xs bg-zinc-950 border border-zinc-800 rounded-lg text-zinc-100 placeholder-zinc-400 focus:outline-none focus:border-blue-500 transition"
            />
          </div>

          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="px-3 py-1.5 text-xs bg-zinc-950 border border-zinc-800 rounded-lg text-zinc-300 focus:outline-none focus:border-blue-500 transition"
          >
            <option value="">All Roles</option>
            <option value="Administrator">Administrator</option>
            <option value="Sales Manager">Sales Manager</option>
            <option value="Salesperson">Salesperson</option>
            <option value="Developer">Developer</option>
            <option value="Video Editor">Video Editor</option>
          </select>
        </div>

        {/* Team Table */}
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 overflow-hidden shadow-sm">
          {isLoading ? (
            <div className="p-12 text-center text-xs text-zinc-400">Loading team members...</div>
          ) : team.length === 0 ? (
            <EmptyState
              icon={<Users className="w-8 h-8 text-zinc-400" />}
              title="No team members found"
              description="Adjust your search or add a team member."
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-zinc-300">
                <thead className="bg-zinc-900 text-zinc-400 border-b border-zinc-800 uppercase font-semibold text-[11px] tracking-wider">
                  <tr>
                    <th className="px-4 py-3">Member</th>
                    <th className="px-4 py-3">Role</th>
                    <th className="px-4 py-3">Account Status</th>
                    <th className="px-4 py-3">Phone</th>
                    <th className="px-4 py-3">Joined Date</th>
                    {isAdmin && <th className="px-4 py-3 text-right">Actions</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800/60">
                  {team.map((member) => (
                    <tr key={member.id} className="hover:bg-zinc-800/40 transition">
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-blue-400 font-bold text-xs shrink-0">
                            {member.first_name?.[0] || member.email[0].toUpperCase()}
                          </div>
                          <div>
                            <span className="font-semibold text-zinc-100 block">
                              {member.full_name || member.username}
                            </span>
                            <span className="text-[11px] text-zinc-400 font-mono block">
                              {member.email}
                            </span>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3.5">
                        <RoleBadge role={member.role} />
                      </td>
                      <td className="px-4 py-3.5">
                        {member.is_active ? (
                          <span className="inline-flex items-center gap-1.5 text-xs text-emerald-400">
                            <CheckCircle2 className="w-3.5 h-3.5" /> Active
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 text-xs text-rose-400">
                            <XCircle className="w-3.5 h-3.5" /> Deactivated
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3.5 text-zinc-300 font-mono">
                        {member.phone || '—'}
                      </td>
                      <td className="px-4 py-3.5 font-mono text-zinc-400">
                        {new Date(member.created_at).toLocaleDateString()}
                      </td>
                      {isAdmin && (
                        <td className="px-4 py-3.5 text-right space-x-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setEditUser(member);
                              setEditRole(member.role);
                            }}
                          >
                            Change Role
                          </Button>
                          {member.id !== currentUser?.id && (
                            <Button
                              variant={member.is_active ? 'danger' : 'success'}
                              size="sm"
                              onClick={() => handleToggleActive(member)}
                              title={member.is_active ? 'Deactivate User' : 'Activate User'}
                            >
                              <Power className="w-3.5 h-3.5" />
                            </Button>
                          )}
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Invite Member Modal */}
      <Modal
        isOpen={isInviteOpen}
        onClose={() => setIsInviteOpen(false)}
        title="Invite / Create Team Member"
        description="Add a Roo4Tech staff account with tailored CRM role permissions."
        maxWidth="lg"
      >
        <form onSubmit={handleCreateMember} className="space-y-4">
          {formError && (
            <div className="p-3 rounded-lg bg-rose-950/50 border border-rose-800/60 text-xs text-rose-300">
              {formError}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-zinc-300 mb-1">First Name</label>
              <input
                type="text"
                value={newMember.first_name}
                onChange={(e) => setNewMember({ ...newMember, first_name: e.target.value })}
                placeholder="e.g. Daniyal"
                className="w-full px-3 py-1.5 text-xs bg-zinc-950 border border-zinc-800 rounded-lg text-zinc-100 placeholder-zinc-400 focus:outline-none focus:border-blue-500 transition"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-300 mb-1">Last Name</label>
              <input
                type="text"
                value={newMember.last_name}
                onChange={(e) => setNewMember({ ...newMember, last_name: e.target.value })}
                placeholder="e.g. Tariq"
                className="w-full px-3 py-1.5 text-xs bg-zinc-950 border border-zinc-800 rounded-lg text-zinc-100 placeholder-zinc-400 focus:outline-none focus:border-blue-500 transition"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-zinc-300 mb-1">Work Email *</label>
              <input
                type="email"
                required
                value={newMember.email}
                onChange={(e) => setNewMember({ ...newMember, email: e.target.value })}
                placeholder="daniyal@roo4tech.com"
                className="w-full px-3 py-1.5 text-xs bg-zinc-950 border border-zinc-800 rounded-lg text-zinc-100 placeholder-zinc-400 focus:outline-none focus:border-blue-500 transition"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-300 mb-1">Phone</label>
              <input
                type="text"
                value={newMember.phone}
                onChange={(e) => setNewMember({ ...newMember, phone: e.target.value })}
                placeholder="+92 300 0000000"
                className="w-full px-3 py-1.5 text-xs bg-zinc-950 border border-zinc-800 rounded-lg text-zinc-100 placeholder-zinc-400 focus:outline-none focus:border-blue-500 transition"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-zinc-300 mb-1">Role Assignment *</label>
              <select
                value={newMember.role}
                onChange={(e) => setNewMember({ ...newMember, role: e.target.value as UserRole })}
                className="w-full px-3 py-1.5 text-xs bg-zinc-950 border border-zinc-800 rounded-lg text-zinc-300 focus:outline-none focus:border-blue-500 transition"
              >
                <option value="Administrator">Administrator (Full Access)</option>
                <option value="Sales Manager">Sales Manager (Lead/Client Management & Pipeline)</option>
                <option value="Salesperson">Salesperson (Assigned Leads & Clients)</option>
                <option value="Developer">Developer (Read-Only Client/Project Specs)</option>
                <option value="Video Editor">Video Editor (Read-Only Deliverables)</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-300 mb-1">Temporary Password</label>
              <input
                type="password"
                value={newMember.password}
                onChange={(e) => setNewMember({ ...newMember, password: e.target.value })}
                placeholder="Default: Roo4TechPassword2026!"
                className="w-full px-3 py-1.5 text-xs bg-zinc-950 border border-zinc-800 rounded-lg text-zinc-100 placeholder-zinc-400 focus:outline-none focus:border-blue-500 transition"
              />
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-zinc-800">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsInviteOpen(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button type="submit" size="sm" isLoading={isSubmitting}>
              Create Account
            </Button>
          </div>
        </form>
      </Modal>

      {/* Edit Role Modal */}
      {editUser && (
        <Modal
          isOpen={!!editUser}
          onClose={() => setEditUser(null)}
          title={`Update Role for ${editUser.full_name || editUser.email}`}
          maxWidth="sm"
        >
          <form onSubmit={handleUpdateRole} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-zinc-300 mb-1">Select New Role</label>
              <select
                value={editRole}
                onChange={(e) => setEditRole(e.target.value as UserRole)}
                className="w-full px-3 py-1.5 text-xs bg-zinc-950 border border-zinc-800 rounded-lg text-zinc-300 focus:outline-none focus:border-blue-500 transition"
              >
                <option value="Administrator">Administrator</option>
                <option value="Sales Manager">Sales Manager</option>
                <option value="Salesperson">Salesperson</option>
                <option value="Developer">Developer</option>
                <option value="Video Editor">Video Editor</option>
              </select>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-zinc-800">
              <Button type="button" variant="outline" size="sm" onClick={() => setEditUser(null)}>
                Cancel
              </Button>
              <Button type="submit" size="sm" isLoading={isUpdatingRole}>
                Save Role
              </Button>
            </div>
          </form>
        </Modal>
      )}
    </AppLayout>
  );
}
