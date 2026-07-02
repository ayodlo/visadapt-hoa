export const REQUEST_TYPES = [
  { value: 'FENCE', label: 'Fence' },
  { value: 'EXTERIOR_PAINT', label: 'Exterior Paint' },
  { value: 'LANDSCAPING', label: 'Landscaping' },
  { value: 'SOLAR', label: 'Solar Panels' },
  { value: 'ROOF', label: 'Roof' },
  { value: 'SHED', label: 'Shed' },
  { value: 'OTHER', label: 'Other' },
] as const;

export const REQUEST_STATUSES = [
  { value: 'DRAFT', label: 'Draft' },
  { value: 'SUBMITTED', label: 'Submitted' },
  { value: 'UNDER_REVIEW', label: 'Under Review' },
  { value: 'NEEDS_MORE_INFORMATION', label: 'Needs More Info' },
  { value: 'APPROVED', label: 'Approved' },
  { value: 'DENIED', label: 'Denied' },
  { value: 'WITHDRAWN', label: 'Withdrawn' },
] as const;

export type RequestTypeValue = (typeof REQUEST_TYPES)[number]['value'];
export type RequestStatusValue = (typeof REQUEST_STATUSES)[number]['value'];

export function requestTypeLabel(value: string) {
  return REQUEST_TYPES.find((t) => t.value === value)?.label ?? value;
}

export function requestStatusLabel(value: string) {
  return REQUEST_STATUSES.find((s) => s.value === value)?.label ?? value;
}

export const ATTACHMENT_LABELS = [
  'Site Plan / Plot Diagram',
  'Elevation Drawing or Photo',
  'Material / Color Samples',
  'Contractor Quote or Bid',
  'Before Photo',
  'Supporting Document',
] as const;
