import { describe, it, expect } from 'vitest';
import {
  VIOLATION_TYPES,
  VIOLATION_STATUSES,
  APPEAL_STATUSES,
  RESPONDABLE_STATUSES,
  APPEALABLE_STATUSES,
  violationTypeLabel,
  violationStatusLabel,
  residentStatusLabel,
} from '@/lib/violations';

describe('VIOLATION_TYPES', () => {
  it('includes all 8 defined types', () => {
    expect(VIOLATION_TYPES).toHaveLength(8);
  });

  it('includes LANDSCAPING_MAINTENANCE', () => {
    expect(VIOLATION_TYPES.some((t) => t.value === 'LANDSCAPING_MAINTENANCE')).toBe(true);
  });
});

describe('VIOLATION_STATUSES', () => {
  it('includes all 7 workflow statuses', () => {
    expect(VIOLATION_STATUSES).toHaveLength(7);
  });

  it('starts with DRAFT and ends with CLOSED', () => {
    expect(VIOLATION_STATUSES[0].value).toBe('DRAFT');
    expect(VIOLATION_STATUSES[VIOLATION_STATUSES.length - 1].value).toBe('CLOSED');
  });
});

describe('APPEAL_STATUSES', () => {
  it('includes all 5 appeal statuses', () => {
    expect(APPEAL_STATUSES).toHaveLength(5);
  });

  it('includes APPROVED and DENIED', () => {
    const values = APPEAL_STATUSES.map((s) => s.value);
    expect(values).toContain('APPROVED');
    expect(values).toContain('DENIED');
  });
});

describe('violationTypeLabel', () => {
  it('returns the human label for a known type', () => {
    expect(violationTypeLabel('LANDSCAPING_MAINTENANCE')).toBe('Landscaping & Maintenance');
    expect(violationTypeLabel('PET_VIOLATION')).toBe('Pet Violation');
    expect(violationTypeLabel('TRASH_AND_DEBRIS')).toBe('Trash & Debris');
  });

  it('returns the raw value for an unknown type', () => {
    expect(violationTypeLabel('UNKNOWN_TYPE')).toBe('UNKNOWN_TYPE');
  });
});

describe('violationStatusLabel', () => {
  it('returns the human label for known statuses', () => {
    expect(violationStatusLabel('NOTICE_SENT')).toBe('Notice Sent');
    expect(violationStatusLabel('RESIDENT_RESPONDED')).toBe('Responded');
    expect(violationStatusLabel('UNDER_REVIEW')).toBe('Under Review');
    expect(violationStatusLabel('ESCALATED')).toBe('Escalated');
  });

  it('returns the raw value for unknown status', () => {
    expect(violationStatusLabel('BOGUS')).toBe('BOGUS');
  });
});

describe('residentStatusLabel', () => {
  it('maps NOTICE_SENT to resident-friendly label', () => {
    expect(residentStatusLabel('NOTICE_SENT')).toBe('Notice Received');
  });

  it('maps RESIDENT_RESPONDED correctly', () => {
    expect(residentStatusLabel('RESIDENT_RESPONDED')).toBe('Response Submitted');
  });

  it('maps RESOLVED correctly', () => {
    expect(residentStatusLabel('RESOLVED')).toBe('Resolved');
  });

  it('replaces underscores for unknown values', () => {
    expect(residentStatusLabel('SOME_STATUS')).toBe('SOME STATUS');
  });
});

describe('RESPONDABLE_STATUSES', () => {
  it('only includes NOTICE_SENT', () => {
    expect(RESPONDABLE_STATUSES).toEqual(['NOTICE_SENT']);
  });

  it('does not include RESOLVED or CLOSED', () => {
    expect(RESPONDABLE_STATUSES).not.toContain('RESOLVED');
    expect(RESPONDABLE_STATUSES).not.toContain('CLOSED');
  });
});

describe('APPEALABLE_STATUSES', () => {
  it('includes NOTICE_SENT', () => {
    expect(APPEALABLE_STATUSES).toContain('NOTICE_SENT');
  });

  it('includes RESIDENT_RESPONDED', () => {
    expect(APPEALABLE_STATUSES).toContain('RESIDENT_RESPONDED');
  });

  it('includes ESCALATED', () => {
    expect(APPEALABLE_STATUSES).toContain('ESCALATED');
  });

  it('does not include DRAFT', () => {
    expect(APPEALABLE_STATUSES).not.toContain('DRAFT');
  });

  it('does not include RESOLVED or CLOSED', () => {
    expect(APPEALABLE_STATUSES).not.toContain('RESOLVED');
    expect(APPEALABLE_STATUSES).not.toContain('CLOSED');
  });
});
