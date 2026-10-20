'use client';

import React, { useEffect, useState } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { StatCard } from '@/components/ui/StatCard';
import { StatusBadge } from '@/components/ui/Badge';
import { useCompany } from '@/context/CompanyContext';
import { api } from '@/lib/api';
import { DashboardStats } from '@/types/crm';
import {
  BarChart3,
  TrendingUp,
  Percent,
  CheckCircle2,
  Users,
  Target,
  Award,
} from 'lucide-react';

export default function ReportsPage() {
  const { formatCurrency, currency } = useCompany();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    api.getDashboardStats().then((data) => {
      setStats(data);
      setIsLoading(false);
    });
  }, []);

  const totalLeads = stats?.leads.total || 0;
  const wonLeads = stats?.leads.won || 0;
  const conversionRate = totalLeads > 0 ? ((wonLeads / totalLeads) * 100).toFixed(1) : '0';
  const totalPipeline = stats?.pipeline_summary?.reduce((a, b) => a + b.budget, 0) || 0;
  const wonBudget = stats?.pipeline_summary?.find((s) => s.status === 'Won')?.budget || 0;

  return (
    <AppLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
            Sales & Performance Reports
          </h1>
          <p className="text-xs sm:text-sm text-zinc-400 mt-1">
            Real database metrics analyzing Roo4Tech lead conversions, deals won, and pipeline value.
          </p>
        </div>

        {/* Top Report KPI Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            title="Conversion Rate"
            value={`${conversionRate}%`}
            subtitle="Leads converted to won clients"
            icon={<Percent className="w-5 h-5 text-emerald-400" />}
            accentColor="emerald"
          />
          <StatCard
            title="Total Revenue Won"
            value={formatCurrency(wonBudget)}
            subtitle="Closed deals in PKR"
            icon={<Award className="w-5 h-5 text-blue-400" />}
            accentColor="blue"
          />
          <StatCard
            title="Pipeline In Progress"
            value={formatCurrency(totalPipeline - wonBudget)}
            subtitle="Qualified & Proposal pipeline"
            icon={<TrendingUp className="w-5 h-5 text-purple-400" />}
            accentColor="purple"
          />
          <StatCard
            title="Active Clients"
            value={stats?.clients.total || 0}
            subtitle={`${stats?.clients.converted || 0} originated from leads`}
            icon={<Target className="w-5 h-5 text-cyan-400" />}
            accentColor="cyan"
          />
        </div>

        {/* Pipeline Stage Deep Dive */}
        <div className="p-6 rounded-2xl bg-zinc-900/70 border border-zinc-800 space-y-4">
          <h3 className="text-sm font-semibold text-zinc-100 flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-blue-400" />
            Stage by Stage Pipeline Value
          </h3>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-zinc-300">
              <thead className="bg-zinc-900 text-zinc-400 border-b border-zinc-800 uppercase font-semibold text-[11px]">
                <tr>
                  <th className="px-4 py-3">Stage</th>
                  <th className="px-4 py-3">Lead Count</th>
                  <th className="px-4 py-3">Total Estimated Value</th>
                  <th className="px-4 py-3">Share of Total Pipeline</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/60">
                {stats?.pipeline_summary?.map((stage) => {
                  const pct = totalPipeline > 0 ? ((stage.budget / totalPipeline) * 100).toFixed(1) : '0';
                  return (
                    <tr key={stage.status} className="hover:bg-zinc-800/30">
                      <td className="px-4 py-3">
                        <StatusBadge status={stage.status} />
                      </td>
                      <td className="px-4 py-3 font-semibold text-zinc-200">
                        {stage.count}
                      </td>
                      <td className="px-4 py-3 font-mono text-zinc-100 font-bold">
                        {formatCurrency(stage.budget)}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="w-32 h-2 rounded-full bg-zinc-800 overflow-hidden">
                            <div
                              className="h-full rounded-full bg-blue-500"
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                          <span className="font-mono text-zinc-400">{pct}%</span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
