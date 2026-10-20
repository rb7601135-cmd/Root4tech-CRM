import React from 'react';

interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: React.ReactNode;
  trend?: string;
  trendPositive?: boolean;
  accentColor?: 'blue' | 'emerald' | 'amber' | 'purple' | 'rose' | 'cyan';
}

export function StatCard({
  title,
  value,
  subtitle,
  icon,
  trend,
  trendPositive,
  accentColor = 'blue',
}: StatCardProps) {
  const colorMap = {
    blue: 'from-blue-600/10 to-transparent border-blue-500/20 text-blue-400',
    emerald: 'from-emerald-600/10 to-transparent border-emerald-500/20 text-emerald-400',
    amber: 'from-amber-600/10 to-transparent border-amber-500/20 text-amber-400',
    purple: 'from-purple-600/10 to-transparent border-purple-500/20 text-purple-400',
    rose: 'from-rose-600/10 to-transparent border-rose-500/20 text-rose-400',
    cyan: 'from-cyan-600/10 to-transparent border-cyan-500/20 text-cyan-400',
  };

  return (
    <div
      className={`relative overflow-hidden rounded-xl border bg-gradient-to-br bg-zinc-900/90 p-5 shadow-sm transition hover:border-zinc-700 ${colorMap[accentColor]}`}
    >
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium uppercase tracking-wider text-zinc-400">{title}</span>
        <div className={`p-2.5 rounded-lg bg-zinc-800/80 ${colorMap[accentColor]}`}>{icon}</div>
      </div>

      <div className="mt-4 flex items-baseline gap-2">
        <span className="text-2xl font-bold tracking-tight text-zinc-100">{value}</span>
        {trend && (
          <span
            className={`text-xs font-medium ${
              trendPositive ? 'text-emerald-400' : 'text-rose-400'
            }`}
          >
            {trend}
          </span>
        )}
      </div>

      {subtitle && <p className="mt-1 text-xs text-zinc-400">{subtitle}</p>}
    </div>
  );
}

export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center p-12 text-center rounded-xl border border-dashed border-zinc-800 bg-zinc-900/40">
      <div className="p-4 rounded-full bg-zinc-800/60 text-zinc-400 mb-4">{icon}</div>
      <h3 className="text-base font-semibold text-zinc-200">{title}</h3>
      <p className="mt-1 text-xs text-zinc-400 max-w-sm">{description}</p>
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
