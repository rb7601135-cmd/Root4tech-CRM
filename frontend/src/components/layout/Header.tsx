'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Menu,
  Search,
  Bell,
  Plus,
  User as UserIcon,
  Settings,
  LogOut,
  Shield,
  Building,
  ExternalLink,
  CheckCheck,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useCompany } from '@/context/CompanyContext';
import { RoleBadge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { api } from '@/lib/api';
import { Notification } from '@/types/crm';

interface HeaderProps {
  isCollapsed: boolean;
  setIsCollapsed: (collapsed: boolean) => void;
  onOpenNewLead?: () => void;
}

export function Header({ isCollapsed, setIsCollapsed, onOpenNewLead }: HeaderProps) {
  const router = useRouter();
  const { user, logout } = useAuth();
  const { settings } = useCompany();
  const [searchQuery, setSearchQuery] = useState('');
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    router.push(`/leads?search=${encodeURIComponent(searchQuery.trim())}`);
  };

  return (
    <header className="sticky top-0 z-30 flex items-center justify-between h-16 px-4 sm:px-6 bg-zinc-950/80 backdrop-blur-md border-b border-zinc-800/80">
      {/* Left: Sidebar Toggle & Search */}
      <div className="flex items-center gap-3 sm:gap-4 flex-1 max-w-xl">
        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="p-2 rounded-lg text-zinc-400 hover:text-zinc-100 hover:bg-zinc-900 transition"
          aria-label="Toggle Navigation"
        >
          <Menu className="w-5 h-5" />
        </button>

        <form onSubmit={handleSearchSubmit} className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search leads, clients, companies..."
            className="w-full pl-9 pr-4 py-1.5 text-xs sm:text-sm bg-zinc-900/90 border border-zinc-800 rounded-lg text-zinc-100 placeholder-zinc-400 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition"
          />
        </form>
      </div>

      {/* Right: Quick actions, notifications, user profile */}
      <div className="flex items-center gap-2 sm:gap-3">
        {onOpenNewLead && (
          <Button
            size="sm"
            onClick={onOpenNewLead}
            icon={<Plus className="w-3.5 h-3.5" />}
            className="hidden sm:inline-flex"
          >
            Add Lead
          </Button>
        )}

        {/* Notification Bell with Realtime API */}
        <NotificationMenu />

        {/* User Profile Menu */}
        <div className="relative">
          <button
            onClick={() => setShowProfileMenu(!showProfileMenu)}
            className="flex items-center gap-2 p-1.5 rounded-lg hover:bg-zinc-900 transition focus:outline-none"
          >
            <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white font-bold text-xs shadow-sm">
              {user?.first_name?.[0] || user?.email?.[0]?.toUpperCase() || 'U'}
            </div>
            <div className="hidden md:block text-left">
              <span className="block text-xs font-medium text-zinc-200 leading-tight">
                {user?.full_name || user?.email}
              </span>
              <span className="block text-[10px] text-zinc-400">
                {user?.role}
              </span>
            </div>
          </button>

          {showProfileMenu && (
            <div className="absolute right-0 mt-2 w-56 rounded-xl bg-zinc-900 border border-zinc-800 shadow-2xl p-2 z-50 animate-in fade-in zoom-in-95">
              <div className="px-3 py-2 border-b border-zinc-800 mb-1">
                <p className="text-xs font-semibold text-zinc-100 truncate">{user?.full_name}</p>
                <p className="text-[11px] text-zinc-400 truncate">{user?.email}</p>
                <div className="mt-1.5">
                  <RoleBadge role={user?.role || 'Salesperson'} />
                </div>
              </div>

              <div className="space-y-0.5">
                <Link
                  href="/profile"
                  onClick={() => setShowProfileMenu(false)}
                  className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs text-zinc-300 hover:text-white hover:bg-zinc-800 transition"
                >
                  <UserIcon className="w-4 h-4 text-blue-400" />
                  <span>My Profile & Password</span>
                </Link>

                <Link
                  href="/settings"
                  onClick={() => setShowProfileMenu(false)}
                  className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs text-zinc-300 hover:text-white hover:bg-zinc-800 transition"
                >
                  <Settings className="w-4 h-4 text-zinc-400" />
                  <span>Company Settings</span>
                </Link>

                <button
                  onClick={() => {
                    setShowProfileMenu(false);
                    logout();
                  }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs text-rose-400 hover:bg-rose-950/40 transition text-left"
                >
                  <LogOut className="w-4 h-4" />
                  <span>Log Out</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}

function NotificationMenu() {
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  const fetchNotifications = async () => {
    try {
      const res = await api.getNotifications();
      const list = Array.isArray(res) ? res : res.results || [];
      setNotifications(list);
      setUnreadCount(list.filter((n) => !n.is_read).length);
    } catch {
      // Ignore background notification fetch errors
    }
  };

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 15000); // 15s poll for real-time alerts
    return () => clearInterval(interval);
  }, []);

  const handleMarkAllRead = async () => {
    try {
      await api.markAllNotificationsRead();
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
      setUnreadCount(0);
    } catch (err) {
      console.error(err);
    }
  };

  const handleNotificationClick = async (notif: Notification) => {
    if (!notif.is_read) {
      api.markNotificationRead(notif.id).catch(console.error);
      setNotifications((prev) =>
        prev.map((n) => (n.id === notif.id ? { ...n, is_read: true } : n))
      );
      setUnreadCount((c) => Math.max(0, c - 1));
    }
    setIsOpen(false);
  };

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 rounded-lg text-zinc-400 hover:text-zinc-100 hover:bg-zinc-900 transition"
        aria-label="Notifications"
      >
        <Bell className="w-4 h-4" />
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 w-4 h-4 rounded-full bg-blue-600 text-white text-[9px] font-bold flex items-center justify-center ring-2 ring-zinc-950 animate-pulse">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 sm:w-96 rounded-2xl bg-zinc-900/95 backdrop-blur-xl border border-zinc-800 shadow-2xl p-4 z-50 animate-in fade-in zoom-in-95">
          <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-zinc-200">
                CRM Real-Time Notifications
              </span>
              {unreadCount > 0 && (
                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-blue-500/20 text-blue-300 font-medium">
                  {unreadCount} new
                </span>
              )}
            </div>
            {unreadCount > 0 && (
              <button
                onClick={handleMarkAllRead}
                className="text-[11px] text-blue-400 hover:text-blue-300 flex items-center gap-1 transition"
              >
                <CheckCheck className="w-3.5 h-3.5" />
                Mark all read
              </button>
            )}
          </div>

          <div className="mt-3 max-h-72 overflow-y-auto divide-y divide-zinc-800/60 space-y-1">
            {notifications.length === 0 ? (
              <div className="py-6 text-center text-xs text-zinc-400">
                <p>No notifications yet</p>
                <p className="text-[10px] text-zinc-400 mt-1">
                  Automated reminders, client updates & financial alerts will appear here.
                </p>
              </div>
            ) : (
              notifications.map((notif) => (
                <div
                  key={notif.id}
                  onClick={() => handleNotificationClick(notif)}
                  className={`p-2.5 rounded-xl transition cursor-pointer ${
                    notif.is_read
                      ? 'hover:bg-zinc-800/40 text-zinc-400'
                      : 'bg-blue-950/20 hover:bg-blue-950/30 border border-blue-900/40 text-zinc-200'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-xs font-semibold text-zinc-200 leading-snug">
                      {notif.title}
                    </p>
                    {!notif.is_read && (
                      <span className="w-2 h-2 rounded-full bg-blue-500 shrink-0 mt-1" />
                    )}
                  </div>
                  <p className="mt-1 text-[11px] text-zinc-400 leading-relaxed">
                    {notif.message}
                  </p>
                  <div className="mt-1.5 flex items-center justify-between text-[10px] text-zinc-400 font-mono">
                    <span className="px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-300">
                      {notif.notification_type}
                    </span>
                    <span>{new Date(notif.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

