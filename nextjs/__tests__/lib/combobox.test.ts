import { describe, it, expect } from 'vitest';
import {
  SEARCHABLE_THRESHOLD,
  computeWindow,
  filterOptions,
  nextActiveIndex,
  scrollOffsetFor,
  type ComboOption,
} from '@/lib/combobox';

const options: ComboOption[] = [
  { value: '1', label: 'Devon Lewis', description: 'devon@gmail.com' },
  { value: '2', label: 'ana park', description: 'ana@example.org' },
  { value: '3', label: 'Bo Chen', description: 'bo@gmail.com' },
  { value: '4', label: 'No Email' },
];

const ids = (list: ComboOption[]) => list.map((o) => o.value);

describe('filterOptions', () => {
  it('matches partial labels case-insensitively', () => {
    expect(ids(filterOptions(options, 'dev'))).toEqual(['1']);
    expect(ids(filterOptions(options, 'ANA'))).toEqual(['2']);
  });

  it('matches on the description too, so email search works', () => {
    expect(ids(filterOptions(options, 'gmail'))).toEqual(['1', '3']);
    expect(ids(filterOptions(options, '@example.org'))).toEqual(['2']);
  });

  it('returns everything for an empty or whitespace query', () => {
    expect(filterOptions(options, '')).toHaveLength(4);
    expect(filterOptions(options, '   ')).toHaveLength(4);
  });

  it('handles options without a description', () => {
    expect(ids(filterOptions(options, 'No Email'))).toEqual(['4']);
    expect(filterOptions(options, 'zzz')).toEqual([]);
  });
});

describe('computeWindow', () => {
  const H = 36;
  const VIEW = 288; // 8 rows

  it('starts at the top with overscan clamped to zero', () => {
    const w = computeWindow(1000, 0, VIEW, H);
    expect(w.start).toBe(0);
    expect(w.padTop).toBe(0);
    expect(w.end).toBeGreaterThanOrEqual(9);
  });

  it('renders only a slice of a very long list', () => {
    const w = computeWindow(5000, 0, VIEW, H);
    expect(w.end - w.start).toBeLessThan(30);
  });

  it('keeps total scrollable height constant as it scrolls', () => {
    const total = 500;
    for (const scroll of [0, 720, 5000, 17_000]) {
      const w = computeWindow(total, scroll, VIEW, H);
      const rendered = (w.end - w.start) * H;
      expect(w.padTop + rendered + w.padBottom).toBe(total * H);
    }
  });

  it('moves the window as the user scrolls', () => {
    const a = computeWindow(500, 0, VIEW, H);
    const b = computeWindow(500, 3600, VIEW, H);
    expect(b.start).toBeGreaterThan(a.start);
    expect(b.padTop).toBe(b.start * H);
  });

  it('clamps at the end of the list', () => {
    const w = computeWindow(20, 999_999, VIEW, H);
    expect(w.end).toBe(20);
    expect(w.padBottom).toBe(0);
  });

  it('never produces negative padding or a reversed range', () => {
    for (const scroll of [-500, 0, 100, 99_999]) {
      const w = computeWindow(50, scroll, VIEW, H);
      expect(w.padTop).toBeGreaterThanOrEqual(0);
      expect(w.padBottom).toBeGreaterThanOrEqual(0);
      expect(w.end).toBeGreaterThanOrEqual(w.start);
    }
  });

  it('handles an empty list', () => {
    expect(computeWindow(0, 0, VIEW, H)).toEqual({ start: 0, end: 0, padTop: 0, padBottom: 0 });
  });

  it('renders a short list in full', () => {
    const w = computeWindow(5, 0, VIEW, H);
    expect(w.start).toBe(0);
    expect(w.end).toBe(5);
  });
});

describe('scrollOffsetFor', () => {
  const H = 36;
  const VIEW = 288;

  it('returns null when the row is already visible', () => {
    expect(scrollOffsetFor(2, 0, VIEW, H)).toBeNull();
  });

  it('scrolls up when the row is above the viewport', () => {
    expect(scrollOffsetFor(1, 360, VIEW, H)).toBe(36);
  });

  it('scrolls down just enough when the row is below', () => {
    // Row 10 ends at 396; viewport is 288 tall, so top must be 108.
    expect(scrollOffsetFor(10, 0, VIEW, H)).toBe(108);
  });
});

describe('nextActiveIndex', () => {
  it('moves within bounds', () => {
    expect(nextActiveIndex(0, 1, 5)).toBe(1);
    expect(nextActiveIndex(3, -1, 5)).toBe(2);
  });

  it('clamps rather than wrapping', () => {
    expect(nextActiveIndex(4, 1, 5)).toBe(4);
    expect(nextActiveIndex(0, -1, 5)).toBe(0);
  });

  it('enters the list from either end when nothing is active', () => {
    expect(nextActiveIndex(-1, 1, 5)).toBe(0);
    expect(nextActiveIndex(-1, -1, 5)).toBe(4);
  });

  it('stays inactive for an empty list', () => {
    expect(nextActiveIndex(-1, 1, 0)).toBe(-1);
  });
});

describe('SEARCHABLE_THRESHOLD', () => {
  it('sits in the 10-15 band where a plain dropdown stops being usable', () => {
    expect(SEARCHABLE_THRESHOLD).toBeGreaterThanOrEqual(10);
    expect(SEARCHABLE_THRESHOLD).toBeLessThanOrEqual(15);
  });
});
