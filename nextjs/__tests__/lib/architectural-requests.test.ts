import { describe, it, expect } from 'vitest';
import {
  REQUEST_TYPES,
  REQUEST_STATUSES,
  ATTACHMENT_LABELS,
  requestTypeLabel,
  requestStatusLabel,
} from '@/lib/architectural-requests';

describe('REQUEST_TYPES', () => {
  it('includes all 7 defined types', () => {
    expect(REQUEST_TYPES).toHaveLength(7);
  });

  it('includes FENCE and SOLAR', () => {
    const values = REQUEST_TYPES.map((t) => t.value);
    expect(values).toContain('FENCE');
    expect(values).toContain('SOLAR');
  });
});

describe('REQUEST_STATUSES', () => {
  it('includes all 7 workflow statuses', () => {
    expect(REQUEST_STATUSES).toHaveLength(7);
  });

  it('includes NEEDS_MORE_INFORMATION', () => {
    expect(REQUEST_STATUSES.some((s) => s.value === 'NEEDS_MORE_INFORMATION')).toBe(true);
  });

  it('starts with DRAFT', () => {
    expect(REQUEST_STATUSES[0].value).toBe('DRAFT');
  });
});

describe('ATTACHMENT_LABELS', () => {
  it('lists at least 4 label options', () => {
    expect(ATTACHMENT_LABELS.length).toBeGreaterThanOrEqual(4);
  });
});

describe('requestTypeLabel', () => {
  it('returns correct label for FENCE', () => {
    expect(requestTypeLabel('FENCE')).toBe('Fence');
  });

  it('returns correct label for EXTERIOR_PAINT', () => {
    expect(requestTypeLabel('EXTERIOR_PAINT')).toBe('Exterior Paint');
  });

  it('returns correct label for SOLAR', () => {
    expect(requestTypeLabel('SOLAR')).toBe('Solar Panels');
  });

  it('returns the raw value for an unknown type', () => {
    expect(requestTypeLabel('UNKNOWN')).toBe('UNKNOWN');
  });
});

describe('requestStatusLabel', () => {
  it('returns correct label for SUBMITTED', () => {
    expect(requestStatusLabel('SUBMITTED')).toBe('Submitted');
  });

  it('returns correct label for NEEDS_MORE_INFORMATION', () => {
    expect(requestStatusLabel('NEEDS_MORE_INFORMATION')).toBe('Needs More Info');
  });

  it('returns correct label for APPROVED', () => {
    expect(requestStatusLabel('APPROVED')).toBe('Approved');
  });

  it('returns correct label for DENIED', () => {
    expect(requestStatusLabel('DENIED')).toBe('Denied');
  });

  it('returns correct label for WITHDRAWN', () => {
    expect(requestStatusLabel('WITHDRAWN')).toBe('Withdrawn');
  });

  it('returns the raw value for an unknown status', () => {
    expect(requestStatusLabel('PENDING_VOTE')).toBe('PENDING_VOTE');
  });
});
