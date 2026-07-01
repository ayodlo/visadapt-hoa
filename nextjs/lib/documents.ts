export const DOCUMENT_CATEGORIES = [
  { value: 'CC_AND_RS', label: 'CC&Rs' },
  { value: 'RULES_AND_REGS', label: 'Rules & Regulations' },
  { value: 'MEETING_MINUTES', label: 'Meeting Minutes' },
  { value: 'FINANCIALS', label: 'Financial Documents' },
  { value: 'INSURANCE', label: 'Insurance' },
  { value: 'COMMUNITY_FORMS', label: 'Community Forms' },
  { value: 'MAINTENANCE', label: 'Maintenance' },
  { value: 'OTHER', label: 'Other' },
] as const;

export type DocCategoryValue = (typeof DOCUMENT_CATEGORIES)[number]['value'];

export function categoryLabel(value: string): string {
  return DOCUMENT_CATEGORIES.find((c) => c.value === value)?.label ?? value;
}

export const CATEGORY_FILTER_OPTIONS = [
  { value: '', label: 'All Categories' },
  ...DOCUMENT_CATEGORIES,
];
