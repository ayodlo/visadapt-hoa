export const VIOLATION_TYPES = [
  { value: 'LANDSCAPING_MAINTENANCE', label: 'Landscaping & Maintenance' },
  { value: 'PARKING', label: 'Parking' },
  { value: 'NOISE', label: 'Noise' },
  { value: 'PROPERTY_APPEARANCE', label: 'Property Appearance' },
  { value: 'UNAUTHORIZED_MODIFICATION', label: 'Unauthorized Modification' },
  { value: 'PET_VIOLATION', label: 'Pet Violation' },
  { value: 'TRASH_AND_DEBRIS', label: 'Trash & Debris' },
  { value: 'OTHER', label: 'Other' },
] as const;

export const VIOLATION_STATUSES = [
  { value: 'DRAFT', label: 'Draft' },
  { value: 'NOTICE_SENT', label: 'Notice Sent' },
  { value: 'RESIDENT_RESPONDED', label: 'Responded' },
  { value: 'UNDER_REVIEW', label: 'Under Review' },
  { value: 'RESOLVED', label: 'Resolved' },
  { value: 'ESCALATED', label: 'Escalated' },
  { value: 'CLOSED', label: 'Closed' },
] as const;

export const APPEAL_STATUSES = [
  { value: 'SUBMITTED', label: 'Appeal Submitted' },
  { value: 'UNDER_REVIEW', label: 'Appeal Under Review' },
  { value: 'APPROVED', label: 'Appeal Approved' },
  { value: 'DENIED', label: 'Appeal Denied' },
  { value: 'WITHDRAWN', label: 'Appeal Withdrawn' },
] as const;

export type ViolationTypeValue = (typeof VIOLATION_TYPES)[number]['value'];
export type ViolationStatusValue = (typeof VIOLATION_STATUSES)[number]['value'];

export function violationTypeLabel(value: string) {
  return VIOLATION_TYPES.find((t) => t.value === value)?.label ?? value;
}

export function violationStatusLabel(value: string) {
  return VIOLATION_STATUSES.find((s) => s.value === value)?.label ?? value;
}

export function residentStatusLabel(value: string) {
  switch (value) {
    case 'NOTICE_SENT': return 'Notice Received';
    case 'RESIDENT_RESPONDED': return 'Response Submitted';
    case 'UNDER_REVIEW': return 'Under Review';
    case 'RESOLVED': return 'Resolved';
    case 'ESCALATED': return 'Escalated';
    case 'CLOSED': return 'Closed';
    default: return value.replace(/_/g, ' ');
  }
}

// Statuses a resident can respond to (respond form visible)
export const RESPONDABLE_STATUSES: ViolationStatusValue[] = ['NOTICE_SENT'];

// Statuses where resident can file an appeal
export const APPEALABLE_STATUSES: ViolationStatusValue[] = [
  'NOTICE_SENT', 'RESIDENT_RESPONDED', 'UNDER_REVIEW', 'ESCALATED',
];
