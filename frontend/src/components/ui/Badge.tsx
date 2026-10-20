import React from 'react';

interface BadgeProps {
  children: React.ReactNode;
  variant?:
    | 'default'
    | 'primary'
    | 'success'
    | 'warning'
    | 'danger'
    | 'info'
    | 'purple'
    | 'gray';
  size?: 'sm' | 'md';
  dot?: boolean;
}

export function Badge({ children, variant = 'default', size = 'sm', dot = false }: BadgeProps) {
  const variantStyles = {
    default: 'bg-zinc-800 text-zinc-300 border-zinc-700',
    primary: 'bg-blue-950/60 text-blue-300 border-blue-800/60',
    success: 'bg-emerald-950/60 text-emerald-300 border-emerald-800/60',
    warning: 'bg-amber-950/60 text-amber-300 border-amber-800/60',
    danger: 'bg-rose-950/60 text-rose-300 border-rose-800/60',
    info: 'bg-cyan-950/60 text-cyan-300 border-cyan-800/60',
    purple: 'bg-purple-950/60 text-purple-300 border-purple-800/60',
    gray: 'bg-zinc-900 text-zinc-400 border-zinc-800',
  };

  const dotStyles = {
    default: 'bg-zinc-400',
    primary: 'bg-blue-400',
    success: 'bg-emerald-400',
    warning: 'bg-amber-400',
    danger: 'bg-rose-400',
    info: 'bg-cyan-400',
    purple: 'bg-purple-400',
    gray: 'bg-zinc-500',
  };

  const sizeStyles = {
    sm: 'text-xs px-2.5 py-0.5',
    md: 'text-sm px-3 py-1',
  };

  return (
    <span
      className={`inline-flex items-center gap-1.5 font-medium rounded-full border ${variantStyles[variant]} ${sizeStyles[size]}`}
    >
      {dot && <span className={`w-1.5 h-1.5 rounded-full ${dotStyles[variant]}`} />}
      {children}
    </span>
  );
}

export function StatusBadge({ status }: { status: string }) {
  switch (status) {
    case 'New':
      return <Badge variant="info" dot>{status}</Badge>;
    case 'Contacted':
      return <Badge variant="primary" dot>{status}</Badge>;
    case 'Qualified':
      return <Badge variant="purple" dot>{status}</Badge>;
    case 'Proposal':
      return <Badge variant="warning" dot>{status}</Badge>;
    case 'Won':
    case 'Active':
      return <Badge variant="success" dot>{status}</Badge>;
    case 'Lead_Converted':
      return <Badge variant="success" dot>Converted</Badge>;
    case 'Lost':
      return <Badge variant="danger" dot>{status}</Badge>;
    case 'Inactive':
    case 'Archived':
      return <Badge variant="gray" dot>{status}</Badge>;
    default:
      return <Badge variant="default">{status}</Badge>;
  }
}

export function PriorityBadge({ priority }: { priority: string }) {
  switch (priority) {
    case 'Urgent':
      return <Badge variant="danger">{priority}</Badge>;
    case 'High':
      return <Badge variant="warning">{priority}</Badge>;
    case 'Medium':
      return <Badge variant="primary">{priority}</Badge>;
    case 'Low':
      return <Badge variant="default">{priority}</Badge>;
    default:
      return <Badge variant="default">{priority}</Badge>;
  }
}

export function RoleBadge({ role }: { role: string }) {
  switch (role) {
    case 'Administrator':
      return <Badge variant="danger">{role}</Badge>;
    case 'Sales Manager':
      return <Badge variant="purple">{role}</Badge>;
    case 'Salesperson':
      return <Badge variant="primary">{role}</Badge>;
    case 'Developer':
      return <Badge variant="info">{role}</Badge>;
    case 'Video Editor':
      return <Badge variant="warning">{role}</Badge>;
    default:
      return <Badge variant="default">{role}</Badge>;
  }
}
