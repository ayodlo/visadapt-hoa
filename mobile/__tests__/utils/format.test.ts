import { formatCents, formatDate, formatDateTime, titleCase } from '@/utils/format';

describe('formatCents', () => {
  it('formats whole dollar amounts', () => {
    expect(formatCents(150000)).toBe('$1,500.00');
  });

  it('formats amounts with cents', () => {
    expect(formatCents(1099)).toBe('$10.99');
  });

  it('formats zero', () => {
    expect(formatCents(0)).toBe('$0.00');
  });
});

describe('formatDate', () => {
  it('formats an ISO date string', () => {
    // Noon UTC so the local-timezone conversion can't cross a calendar-day
    // boundary on any real-world offset, keeping this deterministic in CI.
    expect(formatDate('2026-07-14T12:00:00.000Z')).toBe('Jul 14, 2026');
  });
});

describe('formatDateTime', () => {
  it('formats an ISO date string with a date and a time component', () => {
    // Avoid asserting the exact hour/minute here — those shift with the
    // test runner's local timezone, unlike the date portion.
    expect(formatDateTime('2026-07-14T15:30:00.000Z')).toMatch(/2026, \d{1,2}:\d{2}\s?(AM|PM)?$/);
  });
});

describe('titleCase', () => {
  it('converts a SCREAMING_SNAKE_CASE enum value to Title Case', () => {
    expect(titleCase('UNDER_REVIEW')).toBe('Under Review');
  });

  it('handles a single word', () => {
    expect(titleCase('RESOLVED')).toBe('Resolved');
  });

  it('handles already-lowercase input', () => {
    expect(titleCase('needs_more_information')).toBe('Needs More Information');
  });
});
