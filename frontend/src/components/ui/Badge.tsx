/**
 * PeoplePay585 — Reusable Badge Component
 */

interface BadgeProps {
  children: React.ReactNode;
  variant?: 'default' | 'success' | 'warning' | 'danger' | 'info' | 'purple';
}

const variants: Record<string, string> = {
  default: 'bg-slate-100 text-slate-700',
  success: 'bg-emerald-50 text-emerald-700',
  warning: 'bg-amber-50 text-amber-700',
  danger: 'bg-red-50 text-red-700',
  info: 'bg-blue-50 text-blue-700',
  purple: 'bg-violet-50 text-violet-700',
};

export default function Badge({ children, variant = 'default' }: BadgeProps) {
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${variants[variant]}`}>
      {children}
    </span>
  );
}

/** Maps common status strings to badge variants */
export function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; variant: BadgeProps['variant'] }> = {
    active: { label: 'Live', variant: 'success' },
    inactive: { label: 'Inactive', variant: 'default' },
    terminated: { label: 'Terminated', variant: 'danger' },
    draft: { label: 'Draft', variant: 'default' },
    pending: { label: 'Pending', variant: 'warning' },
    approved: { label: 'Approved', variant: 'success' },
    refused: { label: 'Refused', variant: 'danger' },
    cancelled: { label: 'Cancelled', variant: 'default' },
    computed: { label: 'Computed', variant: 'info' },
    validated: { label: 'Validated', variant: 'purple' },
    paid: { label: 'Paid', variant: 'success' },
    confirmed: { label: 'Confirmed', variant: 'success' },
    expired: { label: 'Dead', variant: 'danger' },
    // Attendance statuses
    present: { label: 'Present', variant: 'success' },
    absent: { label: 'Absent', variant: 'danger' },
    late: { label: 'Late', variant: 'warning' },
    half_day: { label: 'Half Day', variant: 'info' },
  };

  const entry = map[status?.toLowerCase()] || { label: status, variant: 'default' as const };
  return <Badge variant={entry.variant}>{entry.label}</Badge>;
}
