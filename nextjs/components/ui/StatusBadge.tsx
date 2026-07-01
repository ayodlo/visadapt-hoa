const COLORS: Record<string, string> = {
  OPEN: 'bg-yellow-100 text-yellow-800',
  IN_PROGRESS: 'bg-blue-100 text-blue-800',
  RESOLVED: 'bg-green-100 text-green-800',
  CLOSED: 'bg-gray-100 text-gray-600',
  PENDING: 'bg-yellow-100 text-yellow-800',
  PAID: 'bg-green-100 text-green-800',
  OVERDUE: 'bg-red-100 text-red-800',
  WAIVED: 'bg-gray-100 text-gray-600',
  LOW: 'bg-gray-100 text-gray-600',
  MEDIUM: 'bg-blue-100 text-blue-800',
  HIGH: 'bg-orange-100 text-orange-800',
  URGENT: 'bg-red-100 text-red-800',
  ADMIN: 'bg-purple-100 text-purple-800',
  BOARD_MEMBER: 'bg-indigo-100 text-indigo-800',
  RESIDENT: 'bg-gray-100 text-gray-600',
  CC_AND_RS: 'bg-blue-100 text-blue-800',
  RULES_AND_REGS: 'bg-indigo-100 text-indigo-800',
  MEETING_MINUTES: 'bg-green-100 text-green-800',
  FINANCIALS: 'bg-emerald-100 text-emerald-800',
  INSURANCE: 'bg-teal-100 text-teal-800',
  COMMUNITY_FORMS: 'bg-orange-100 text-orange-800',
  MAINTENANCE: 'bg-yellow-100 text-yellow-800',
  OTHER: 'bg-gray-100 text-gray-600',
};

const LABELS: Record<string, string> = {
  IN_PROGRESS: 'In Progress',
  BOARD_MEMBER: 'Board Member',
  CC_AND_RS: 'CC&Rs',
  RULES_AND_REGS: 'Rules & Regulations',
  MEETING_MINUTES: 'Meeting Minutes',
  FINANCIALS: 'Financial Documents',
  COMMUNITY_FORMS: 'Community Forms',
};

interface Props {
  status: string;
  className?: string;
}

export function StatusBadge({ status, className = '' }: Props) {
  const color = COLORS[status] ?? 'bg-gray-100 text-gray-600';
  const label =
    LABELS[status] ??
    status.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${color} ${className}`}
    >
      {label}
    </span>
  );
}
