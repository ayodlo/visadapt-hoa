export const ISSUE_CATEGORIES = [
  { value: 'LANDSCAPING', label: 'Landscaping' },
  { value: 'MAINTENANCE', label: 'Maintenance' },
  { value: 'PARKING', label: 'Parking' },
  { value: 'SAFETY', label: 'Safety' },
  { value: 'NOISE', label: 'Noise' },
  { value: 'GATE_ACCESS', label: 'Gate / Access' },
  { value: 'TRASH', label: 'Trash' },
  { value: 'OTHER', label: 'Other' },
] as const;

export const ISSUE_STATUSES = [
  { value: 'SUBMITTED', label: 'Submitted' },
  { value: 'UNDER_REVIEW', label: 'Under Review' },
  { value: 'ASSIGNED', label: 'Assigned' },
  { value: 'IN_PROGRESS', label: 'In Progress' },
  { value: 'WAITING_ON_VENDOR', label: 'Waiting on Vendor' },
  { value: 'RESOLVED', label: 'Resolved' },
  { value: 'CLOSED', label: 'Closed' },
] as const;

export const ISSUE_PRIORITIES = [
  { value: 'LOW', label: 'Low' },
  { value: 'MEDIUM', label: 'Medium' },
  { value: 'HIGH', label: 'High' },
  { value: 'URGENT', label: 'Urgent' },
] as const;

export const CONTACT_METHODS = ['Email', 'Phone', 'Text'] as const;

export function categoryLabel(value: string) {
  return ISSUE_CATEGORIES.find((c) => c.value === value)?.label ?? value;
}

export function statusLabel(value: string) {
  return ISSUE_STATUSES.find((s) => s.value === value)?.label ?? value;
}

export function priorityLabel(value: string) {
  return ISSUE_PRIORITIES.find((p) => p.value === value)?.label ?? value;
}
