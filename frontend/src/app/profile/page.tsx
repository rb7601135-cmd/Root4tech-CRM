'use client';

import React, { useState } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/Button';
import { RoleBadge } from '@/components/ui/Badge';
import { useAuth } from '@/context/AuthContext';
import { api } from '@/lib/api';
import {
  User,
  Lock,
  Shield,
  CheckCircle2,
  AlertCircle,
  Eye,
  EyeOff,
  Mail,
  KeyRound,
  ShieldCheck,
  Calendar,
} from 'lucide-react';

export default function ProfilePage() {
  const { user } = useAuth();

  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showOldPass, setShowOldPass] = useState(false);
  const [showNewPass, setShowNewPass] = useState(false);

  const [isChangingPass, setIsChangingPass] = useState(false);
  const [passwordSuccess, setPasswordSuccess] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordSuccess(false);
    setPasswordError(null);

    if (newPassword.length < 8) {
      setPasswordError('New password must be at least 8 characters long.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordError('New password and confirm password do not match.');
      return;
    }

    setIsChangingPass(true);

    try {
      await api.changePassword({ old_password: oldPassword, new_password: newPassword });
      setPasswordSuccess(true);
      setOldPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setTimeout(() => setPasswordSuccess(false), 5000);
    } catch (err: unknown) {
      const apiErr = err as {
        data?: { old_password?: string[]; new_password?: string[]; detail?: string };
        message?: string;
      };
      setPasswordError(
        apiErr.data?.old_password?.[0] ||
        apiErr.data?.new_password?.[0] ||
        apiErr.data?.detail ||
        apiErr.message ||
        'Password change failed. Please verify your current password.'
      );
    } finally {
      setIsChangingPass(false);
    }
  };

  const getRoleDescription = (role?: string) => {
    switch (role) {
      case 'Administrator':
        return 'Full administrative access across all CRM modules, settings, team members, and audit logs.';
      case 'Sales Manager':
        return 'Team-wide lead and client oversight, pipeline analytics, quotation approvals, and invoicing management.';
      case 'Salesperson':
        return 'Creation and management of assigned leads, client relationships, quotations, and deal conversions.';
      case 'Developer':
        return 'Read-only access to client specifications and technical milestone deliverables.';
      case 'Video Editor':
        return 'Read-only access to creative specs and client project deliverables.';
      default:
        return 'Standard team member access.';
    }
  };

  return (
    <AppLayout>
      <div className="space-y-6 max-w-5xl">
        {/* Page Header */}
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight flex items-center gap-2.5">
            <User className="w-6 h-6 text-blue-400" />
            My Profile & Security
          </h1>
          <p className="text-xs sm:text-sm text-zinc-400 mt-1">
            Manage your personal profile information, system credentials, and account password.
          </p>
        </div>

        {/* Profile Card Banner */}
        <div className="p-6 rounded-2xl bg-gradient-to-r from-blue-950/40 via-zinc-900 to-zinc-950 border border-zinc-800 shadow-xl flex flex-col sm:flex-row sm:items-center justify-between gap-5">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white font-black text-2xl shadow-lg shadow-blue-500/20 shrink-0">
              {user?.first_name?.[0] || user?.email?.[0]?.toUpperCase() || 'U'}
            </div>
            <div>
              <div className="flex items-center gap-2.5 flex-wrap">
                <h2 className="text-lg font-bold text-white">{user?.full_name || user?.email}</h2>
                <RoleBadge role={user?.role || 'Salesperson'} />
                <span className="px-2 py-0.5 rounded-full bg-emerald-950/60 border border-emerald-800/60 text-emerald-400 text-[10px] font-mono">
                  ● Active
                </span>
              </div>
              <p className="text-xs text-zinc-400 mt-1 flex items-center gap-1.5">
                <Mail className="w-3.5 h-3.5 text-zinc-500" />
                {user?.email}
              </p>
            </div>
          </div>

          <div className="text-left sm:text-right shrink-0">
            <span className="text-[11px] text-zinc-500 block uppercase font-mono tracking-wider">Account ID</span>
            <span className="text-sm font-mono font-bold text-zinc-300">USR-{String(user?.id || 1).padStart(4, '0')}</span>
          </div>
        </div>

        {/* Main 2-Column Content */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Card 1: Profile & Role Details */}
          <div className="p-6 rounded-2xl bg-zinc-900/80 border border-zinc-800 space-y-5 flex flex-col justify-between">
            <div className="space-y-4">
              <div className="flex items-center gap-2 pb-3 border-b border-zinc-800">
                <ShieldCheck className="w-5 h-5 text-blue-400" />
                <h3 className="text-sm font-semibold text-zinc-100">Profile & Role Permissions</h3>
              </div>

              <div className="space-y-3 text-xs">
                <div>
                  <span className="text-zinc-500 block text-[11px] uppercase tracking-wider font-medium">Full Name</span>
                  <span className="text-zinc-200 font-semibold text-sm mt-0.5 block">
                    {user?.full_name || 'Not specified'}
                  </span>
                </div>

                <div>
                  <span className="text-zinc-500 block text-[11px] uppercase tracking-wider font-medium">Email Address</span>
                  <span className="text-zinc-200 font-semibold text-sm mt-0.5 block font-mono">
                    {user?.email}
                  </span>
                </div>

                <div>
                  <span className="text-zinc-500 block text-[11px] uppercase tracking-wider font-medium">Assigned Role</span>
                  <span className="text-zinc-200 font-semibold mt-0.5 block">
                    {user?.role || 'Salesperson'}
                  </span>
                  <p className="text-[11px] text-zinc-400 mt-1 leading-relaxed bg-zinc-950/60 p-2.5 rounded-xl border border-zinc-800/80">
                    {getRoleDescription(user?.role)}
                  </p>
                </div>
              </div>
            </div>

            <div className="pt-4 border-t border-zinc-800/80 text-[11px] text-zinc-500">
              To update your name or role assignment, please contact a CRM Administrator.
            </div>
          </div>

          {/* Card 2: Change Password */}
          <div className="p-6 rounded-2xl bg-zinc-900/80 border border-zinc-800 space-y-5">
            <div className="flex items-center gap-2 pb-3 border-b border-zinc-800">
              <KeyRound className="w-5 h-5 text-indigo-400" />
              <div>
                <h3 className="text-sm font-semibold text-zinc-100">Change Password</h3>
                <p className="text-[11px] text-zinc-400">Update your account credentials to keep your profile secure</p>
              </div>
            </div>

            {passwordSuccess && (
              <div className="p-3.5 rounded-xl bg-emerald-950/60 border border-emerald-800/60 text-xs text-emerald-300 flex items-center gap-2 animate-in fade-in duration-200">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>Password updated successfully!</span>
              </div>
            )}

            {passwordError && (
              <div className="p-3.5 rounded-xl bg-rose-950/60 border border-rose-800/60 text-xs text-rose-300 flex items-center gap-2 animate-in fade-in duration-200">
                <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                <span>{passwordError}</span>
              </div>
            )}

            <form onSubmit={handleChangePassword} className="space-y-4 text-xs">
              <div>
                <label className="block text-xs font-semibold text-zinc-300 uppercase tracking-wider mb-1">
                  Current Password *
                </label>
                <div className="relative">
                  <input
                    type={showOldPass ? 'text' : 'password'}
                    required
                    value={oldPassword}
                    onChange={(e) => setOldPassword(e.target.value)}
                    placeholder="Enter current password"
                    className="w-full px-3 py-2 pr-9 bg-zinc-950 border border-zinc-800 rounded-xl text-zinc-100 text-xs focus:outline-none focus:border-indigo-500"
                  />
                  <button
                    type="button"
                    onClick={() => setShowOldPass(!showOldPass)}
                    className="absolute right-2.5 top-2.5 text-zinc-500 hover:text-zinc-300 transition"
                  >
                    {showOldPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-300 uppercase tracking-wider mb-1">
                  New Password (Min. 8 characters) *
                </label>
                <div className="relative">
                  <input
                    type={showNewPass ? 'text' : 'password'}
                    required
                    minLength={8}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Enter new strong password"
                    className="w-full px-3 py-2 pr-9 bg-zinc-950 border border-zinc-800 rounded-xl text-zinc-100 text-xs focus:outline-none focus:border-indigo-500"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPass(!showNewPass)}
                    className="absolute right-2.5 top-2.5 text-zinc-500 hover:text-zinc-300 transition"
                  >
                    {showNewPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-300 uppercase tracking-wider mb-1">
                  Confirm New Password *
                </label>
                <input
                  type="password"
                  required
                  minLength={8}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Repeat new password"
                  className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-xl text-zinc-100 text-xs focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="pt-2">
                <Button
                  type="submit"
                  size="sm"
                  isLoading={isChangingPass}
                  className="w-full bg-indigo-600 hover:bg-indigo-500"
                  icon={<Lock className="w-3.5 h-3.5" />}
                >
                  Update Password
                </Button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
