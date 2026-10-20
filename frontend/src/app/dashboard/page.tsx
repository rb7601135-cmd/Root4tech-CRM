'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { AppLayout } from '@/components/layout/AppLayout';
import { StatCard } from '@/components/ui/StatCard';
import { StatusBadge, PriorityBadge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { useAuth } from '@/context/AuthContext';
import { useCompany } from '@/context/CompanyContext';
import { api } from '@/lib/api';
import { DashboardStats } from '@/types/crm';
import {
  Users,
  Building2,
  TrendingUp,
  Clock,
  CheckCircle2,
  XCircle,
  Calendar,
  Layers,
  ArrowRight,
  Shield,
  Activity,
  Plus,
  FileSpreadsheet,
  Receipt,
  FolderKanban,
  DollarSign,
  CreditCard,
  AlertTriangle,
  Briefcase,
} from 'lucide-react';

export default function DashboardPage() {
  const { user } = useAuth();
  const { formatCurrency, currency } = useCompany();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function loadStats() {
      try {
        const data = await api.getDashboardStats();
        setStats(data);
      } catch (err) {
        console.error('Failed to load dashboard statistics', err);
      } finally {
        setIsLoading(false);
      }
    }
    loadStats();
  }, []);

  const totalPipelineBudget = stats?.pipeline_summary?.reduce((acc, curr) => acc + curr.budget, 0) || 0;

  return (
    <AppLayout>
      <div className="space-y-8">
        {/* Welcome Banner */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 p-6 rounded-2xl bg-gradient-to-r from-blue-950/40 via-zinc-900 to-indigo-950/30 border border-blue-900/40">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
              Welcome back, {user?.first_name || user?.email?.split('@')[0]}!
            </h1>
            <p className="text-xs sm:text-sm text-zinc-400 mt-1">
              Here is your Roo4Tech CRM performance and sales pipeline overview for today.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/leads">
              <Button size="sm" icon={<Plus className="w-3.5 h-3.5" />}>
                Create Lead
              </Button>
            </Link>
          </div>
        </div>

        {/* Primary KPI Stat Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            title="Total Leads"
            value={stats?.leads.total || 0}
            subtitle={`${stats?.leads.new || 0} New, ${stats?.leads.qualified || 0} Qualified`}
            icon={<Users className="w-5 h-5 text-blue-400" />}
            accentColor="blue"
          />
          <StatCard
            title="Total Clients"
            value={stats?.clients.total || 0}
            subtitle={`${stats?.clients.active || 0} Active, ${stats?.clients.converted || 0} From Leads`}
            icon={<Building2 className="w-5 h-5 text-emerald-400" />}
            accentColor="emerald"
          />
          <StatCard
            title="Total Pipeline"
            value={formatCurrency(totalPipelineBudget)}
            subtitle="Estimated values across all active leads"
            icon={<TrendingUp className="w-5 h-5 text-purple-400" />}
            accentColor="purple"
          />
          <StatCard
            title="Deals Won"
            value={stats?.leads.won || 0}
            subtitle={`${stats?.leads.lost || 0} deals closed as lost`}
            icon={<CheckCircle2 className="w-5 h-5 text-amber-400" />}
            accentColor="amber"
          />
        </div>

        {/* Operations & Finance Stat Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            title="Total Invoiced"
            value={formatCurrency(stats?.invoices?.total_invoiced_pkr || 0)}
            subtitle={`${stats?.invoices?.total || 0} Invoices Issued`}
            icon={<Receipt className="w-5 h-5 text-blue-400" />}
            accentColor="blue"
          />
          <StatCard
            title="Payments Collected"
            value={formatCurrency(stats?.invoices?.total_paid_pkr || 0)}
            subtitle={`${stats?.invoices?.total_invoiced_pkr ? Math.round(((stats.invoices.total_paid_pkr / stats.invoices.total_invoiced_pkr) * 100)) : 0}% Realized Collection`}
            icon={<CreditCard className="w-5 h-5 text-emerald-400" />}
            accentColor="emerald"
          />
          <StatCard
            title="Outstanding Balance"
            value={formatCurrency(stats?.invoices?.total_outstanding_pkr || 0)}
            subtitle={`${stats?.invoices?.by_status?.Overdue || 0} Overdue Invoices`}
            icon={<AlertTriangle className="w-5 h-5 text-amber-400" />}
            accentColor="amber"
          />
          <StatCard
            title="Active Projects"
            value={stats?.projects?.active || 0}
            subtitle={`${stats?.projects?.total || 0} Total Workspaces • ${stats?.calendar?.upcoming_meetings || 0} Upcoming Meetings`}
            icon={<FolderKanban className="w-5 h-5 text-purple-400" />}
            accentColor="purple"
          />
        </div>

        {/* Pipeline & Upcoming Follow-ups Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Sales Pipeline Summary (2 Cols) */}
          <div className="lg:col-span-2 p-6 rounded-2xl bg-zinc-900/70 border border-zinc-800 space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
              <div className="flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-blue-400" />
                <h3 className="text-sm font-semibold text-zinc-100">Sales Pipeline Breakdown</h3>
              </div>
              <span className="text-xs text-zinc-400 font-mono">Currency: {currency}</span>
            </div>

            <div className="space-y-3.5">
              {stats?.pipeline_summary?.map((stage) => {
                const percentage = totalPipelineBudget > 0 ? Math.round((stage.budget / totalPipelineBudget) * 100) : 0;
                return (
                  <div key={stage.status} className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <StatusBadge status={stage.status} />
                        <span className="text-zinc-400">({stage.count} {stage.count === 1 ? 'lead' : 'leads'})</span>
                      </div>
                      <span className="font-semibold text-zinc-200">
                        {formatCurrency(stage.budget)}
                      </span>
                    </div>
                    {/* Progress Bar */}
                    <div className="w-full h-2 rounded-full bg-zinc-800 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-blue-600 to-indigo-500 transition-all duration-500"
                        style={{ width: `${Math.max(percentage, stage.count > 0 ? 5 : 0)}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Upcoming Follow-up Leads */}
          <div className="p-6 rounded-2xl bg-zinc-900/70 border border-zinc-800 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-amber-400" />
                <h3 className="text-sm font-semibold text-zinc-100">Upcoming Follow-ups</h3>
              </div>
              <Link href="/leads" className="text-xs text-blue-400 hover:underline">
                View all
              </Link>
            </div>

            {stats?.upcoming_follow_ups?.length === 0 ? (
              <p className="text-xs text-zinc-400 py-6 text-center">
                No upcoming follow-ups scheduled.
              </p>
            ) : (
              <div className="space-y-3">
                {stats?.upcoming_follow_ups?.map((lead) => (
                  <Link
                    key={lead.id}
                    href={`/leads/${lead.id}`}
                    className="block p-3 rounded-xl bg-zinc-800/40 hover:bg-zinc-800/80 border border-zinc-800/70 transition space-y-1.5 group"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-zinc-200 group-hover:text-blue-400 transition truncate">
                        {lead.lead_name}
                      </span>
                      <PriorityBadge priority={lead.priority} />
                    </div>
                    <div className="flex items-center justify-between text-[11px] text-zinc-400">
                      <span>{lead.company || lead.email}</span>
                      <span className="flex items-center gap-1 font-mono text-amber-400">
                        <Clock className="w-3 h-3" />
                        {lead.next_follow_up_date}
                      </span>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Phase 2 Prepared Modules & Recent Activity */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Financial Breakdown & Multi-Currency Panel */}
          <div className="p-6 rounded-2xl bg-zinc-900/70 border border-zinc-800 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
              <div className="flex items-center gap-2">
                <Receipt className="w-4 h-4 text-purple-400" />
                <h3 className="text-sm font-semibold text-zinc-100">Financial Breakdown</h3>
              </div>
              <Link href="/invoices" className="text-xs text-blue-400 hover:underline">
                View all
              </Link>
            </div>

            {stats?.invoices?.financial_summary && stats.invoices.financial_summary.length > 0 ? (
              <div className="space-y-3">
                {stats.invoices.financial_summary.map((curr) => (
                  <div key={curr.currency} className="p-3 rounded-xl bg-zinc-800/40 border border-zinc-800/60 text-xs space-y-1.5">
                    <div className="flex items-center justify-between font-mono">
                      <span className="font-bold text-blue-400">{curr.currency}</span>
                      <span className="text-zinc-200 font-semibold">{curr.currency} {curr.total_invoiced.toLocaleString()}</span>
                    </div>
                    <div className="flex items-center justify-between text-[11px] text-zinc-400">
                      <span>Collected: <strong className="text-emerald-400 font-mono">{curr.currency} {curr.total_paid.toLocaleString()}</strong></span>
                      <span>Balance: <strong className="text-amber-400 font-mono">{curr.currency} {curr.total_outstanding.toLocaleString()}</strong></span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-zinc-400 py-4 text-center italic">
                No financial transactions recorded yet.
              </p>
            )}

            <div className="pt-2 border-t border-zinc-800/60 flex items-center justify-between text-xs">
              <span className="text-zinc-400">Quotations in Pipeline:</span>
              <span className="font-mono text-zinc-200 font-bold">{stats?.quotations?.total || 0}</span>
            </div>
          </div>

          {/* Recent Audit Activities (2 Cols) */}
          <div className="lg:col-span-2 p-6 rounded-2xl bg-zinc-900/70 border border-zinc-800 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
              <div className="flex items-center gap-2">
                <Activity className="w-4 h-4 text-emerald-400" />
                <h3 className="text-sm font-semibold text-zinc-100">Recent Audit Activity</h3>
              </div>
              <Link href="/settings" className="text-xs text-blue-400 hover:underline">
                View all logs
              </Link>
            </div>

            <div className="space-y-2.5">
              {stats?.recent_activities?.map((log) => (
                <div
                  key={log.id}
                  className="flex items-start justify-between p-3 rounded-xl bg-zinc-800/30 border border-zinc-800/60 text-xs gap-3"
                >
                  <div>
                    <span className="font-semibold text-zinc-200 block">
                      {log.action.replace(/_/g, ' ')}
                    </span>
                    <p className="text-zinc-400 mt-0.5">{log.description}</p>
                  </div>
                  <span className="text-[11px] text-zinc-400 font-mono shrink-0">
                    {new Date(log.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
