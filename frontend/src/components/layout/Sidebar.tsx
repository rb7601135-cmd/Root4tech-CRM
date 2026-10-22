'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Users,
  Building2,
  UserCheck,
  BarChart3,
  Settings,
  FileSpreadsheet,
  Receipt,
  FolderKanban,
  Calendar,
  ChevronLeft,
  ChevronRight,
  LogOut,
  Shield,
  Layers,
  Sparkles,
  Briefcase,
  User as UserIcon,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useCompany } from '@/context/CompanyContext';
import { RoleBadge } from '@/components/ui/Badge';

interface SidebarProps {
  isCollapsed: boolean;
  setIsCollapsed: (collapsed: boolean) => void;
}

export function Sidebar({ isCollapsed, setIsCollapsed }: SidebarProps) {
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const { settings } = useCompany();

  const mainNavItems = [
    { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
    { label: 'AI Assistant', href: '/assistant', icon: Sparkles },
    { label: 'Leads', href: '/leads', icon: Users },
    { label: 'Clients', href: '/clients', icon: Building2 },
    { label: 'Services', href: '/services', icon: Briefcase },
    { label: 'Quotations', href: '/quotations', icon: FileSpreadsheet },
    { label: 'Invoices', href: '/invoices', icon: Receipt },
    { label: 'Projects', href: '/projects', icon: FolderKanban },
    { label: 'Calendar', href: '/calendar', icon: Calendar },
    { label: 'Team', href: '/team', icon: UserCheck },
    { label: 'Reports', href: '/reports', icon: BarChart3 },
    { label: 'Settings', href: '/settings', icon: Settings },
  ];

  return (
    <aside
      className={`fixed top-0 left-0 z-40 h-screen transition-all duration-300 bg-zinc-950 border-r border-zinc-800/80 flex flex-col ${
        isCollapsed ? 'w-20' : 'w-64'
      }`}
    >
      {/* Brand Header */}
      <div className="flex items-center justify-between h-16 px-4 border-b border-zinc-800/80">
        {!isCollapsed && (
          <Link href="/dashboard" className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-blue-600 via-indigo-600 to-cyan-500 flex items-center justify-center text-white font-black text-lg shadow-lg shadow-blue-500/20">
              R4
            </div>
            <div>
              <span className="font-bold text-sm tracking-tight text-white block">
                {settings?.company_name || 'Roo4Tech'}
              </span>
              <span className="text-[10px] uppercase tracking-wider text-blue-400 font-semibold block">
                Smart CRM
              </span>
            </div>
          </Link>
        )}

        {isCollapsed && (
          <Link href="/dashboard" className="mx-auto">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white font-black text-lg shadow-md">
              R4
            </div>
          </Link>
        )}

        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          className={`p-1.5 rounded-lg text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900 transition ${
            isCollapsed ? 'hidden' : 'block'
          }`}
          title={isCollapsed ? 'Expand Sidebar' : 'Collapse Sidebar'}
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
      </div>

      {/* Navigation Links */}
      <div className="flex-1 overflow-y-auto px-3 py-4 space-y-6">
        <div>
          {!isCollapsed && (
            <p className="px-3 mb-2 text-[11px] font-semibold tracking-wider text-zinc-400 uppercase">
              Core CRM
            </p>
          )}
          <nav className="space-y-1">
            {mainNavItems.map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href));
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                    isActive
                      ? 'bg-blue-600 text-white shadow-md shadow-blue-600/20 font-semibold'
                      : 'text-zinc-400 hover:text-zinc-100 hover:bg-zinc-900'
                  } ${isCollapsed ? 'justify-center' : ''}`}
                  title={isCollapsed ? item.label : undefined}
                >
                  <Icon className="w-4 h-4 shrink-0" />
                  {!isCollapsed && <span>{item.label}</span>}
                </Link>
              );
            })}
          </nav>
        </div>

      </div>

      {/* User Card & Logout */}
      <div className="p-3 border-t border-zinc-800/80 bg-zinc-950">
        {!isCollapsed ? (
          <div className="flex items-center justify-between gap-2 p-2 rounded-xl bg-zinc-900/70 border border-zinc-800/60">
            <Link
              href="/profile"
              className="flex items-center gap-2.5 overflow-hidden hover:opacity-80 transition group"
              title="View Profile & Security"
            >
              <div className="w-8 h-8 rounded-lg bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-blue-400 font-bold text-xs shrink-0 group-hover:border-blue-400">
                {user?.first_name?.[0] || user?.email?.[0]?.toUpperCase() || 'U'}
              </div>
              <div className="overflow-hidden">
                <p className="text-xs font-semibold text-zinc-200 truncate group-hover:text-blue-300">
                  {user?.full_name || user?.email}
                </p>
                <div className="mt-0.5 scale-90 origin-left">
                  <RoleBadge role={user?.role || 'Salesperson'} />
                </div>
              </div>
            </Link>
            <button
              onClick={logout}
              className="p-1.5 rounded-lg text-zinc-400 hover:text-rose-400 hover:bg-zinc-800 transition shrink-0"
              title="Logout"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <div className="space-y-1.5">
            <Link
              href="/profile"
              className="w-full flex items-center justify-center p-2 rounded-lg text-zinc-400 hover:text-zinc-100 hover:bg-zinc-900 transition"
              title="My Profile & Security"
            >
              <UserIcon className="w-5 h-5 text-blue-400" />
            </Link>
            <button
              onClick={logout}
              className="w-full flex items-center justify-center p-2 rounded-lg text-zinc-400 hover:text-rose-400 hover:bg-zinc-900 transition"
              title="Logout"
            >
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        )}
      </div>
    </aside>
  );
}
