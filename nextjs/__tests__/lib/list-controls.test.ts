import { describe, it, expect } from 'vitest';
import {
  applyListControls,
  distinctValues,
  fieldText,
  filterRows,
  searchRows,
  sortRows,
  type ListField,
} from '@/lib/list-controls';

interface Row {
  id: string;
  name: string;
  email: string;
  role: string;
  amount: number;
  joined: string;
  nickname?: string;
}

const rows: Row[] = [
  { id: '1', name: 'Devon Lewis', email: 'devon@gmail.com', role: 'ADMIN', amount: 300, joined: '2026-03-01' },
  { id: '2', name: 'ana park', email: 'ana@example.org', role: 'RESIDENT', amount: 100, joined: '2026-01-15' },
  { id: '3', name: 'Bo Chen', email: 'bo@gmail.com', role: 'RESIDENT', amount: 250, joined: '2026-02-20', nickname: 'Bobby' },
];

const FIELDS: ListField<Row>[] = [
  { key: 'name', label: 'Name', value: (r) => r.name },
  { key: 'email', label: 'Email', value: (r) => r.email },
  { key: 'role', label: 'Role', value: (r) => r.role, filterable: true },
  { key: 'amount', label: 'Amount', type: 'number', value: (r) => r.amount },
  { key: 'joined', label: 'Joined', type: 'date', value: (r) => r.joined },
  { key: 'nickname', label: 'Nickname', value: (r) => r.nickname ?? null },
];

const ids = (list: Row[]) => list.map((r) => r.id);

describe('fieldText', () => {
  it('falls back to the stringified value', () => {
    expect(fieldText(FIELDS[3], rows[0])).toBe('300');
  });

  it('renders null and undefined as empty string, not "null"', () => {
    expect(fieldText(FIELDS[5], rows[0])).toBe('');
  });

  it('prefers an explicit text accessor', () => {
    const field: ListField<Row> = { key: 'role', label: 'Role', value: (r) => r.role, text: (r) => r.role.toLowerCase() };
    expect(fieldText(field, rows[0])).toBe('admin');
  });
});

describe('searchRows', () => {
  it('matches partial values across any column', () => {
    expect(ids(searchRows(rows, FIELDS, 'dev'))).toEqual(['1']);
    expect(ids(searchRows(rows, FIELDS, 'gmail'))).toEqual(['1', '3']);
  });

  it('is case-insensitive in both directions', () => {
    expect(ids(searchRows(rows, FIELDS, 'ANA'))).toEqual(['2']);
    expect(ids(searchRows(rows, FIELDS, 'devon lewis'))).toEqual(['1']);
  });

  it('returns everything for an empty or whitespace query', () => {
    expect(searchRows(rows, FIELDS, '')).toHaveLength(3);
    expect(searchRows(rows, FIELDS, '   ')).toHaveLength(3);
  });

  it('searches numeric and date columns too', () => {
    expect(ids(searchRows(rows, FIELDS, '250'))).toEqual(['3']);
    expect(ids(searchRows(rows, FIELDS, '2026-01'))).toEqual(['2']);
  });

  it('does not crash or match on rows with missing optional fields', () => {
    expect(ids(searchRows(rows, FIELDS, 'Bobby'))).toEqual(['3']);
  });

  it('returns nothing when there is no match', () => {
    expect(searchRows(rows, FIELDS, 'zzz')).toEqual([]);
  });
});

describe('filterRows', () => {
  it('matches a column exactly', () => {
    expect(ids(filterRows(rows, FIELDS, { role: 'RESIDENT' }))).toEqual(['2', '3']);
  });

  it('treats an empty filter value as "all"', () => {
    expect(filterRows(rows, FIELDS, { role: '' })).toHaveLength(3);
  });

  it('combines multiple filters with AND', () => {
    expect(ids(filterRows(rows, FIELDS, { role: 'RESIDENT', name: 'Bo Chen' }))).toEqual(['3']);
    expect(filterRows(rows, FIELDS, { role: 'ADMIN', name: 'Bo Chen' })).toEqual([]);
  });

  it('drops every row for an unknown field rather than silently passing them', () => {
    expect(filterRows(rows, FIELDS, { nope: 'x' })).toEqual([]);
  });
});

describe('sortRows', () => {
  it('sorts text case-insensitively', () => {
    expect(ids(sortRows(rows, FIELDS, { key: 'name', dir: 'asc' }))).toEqual(['2', '3', '1']);
  });

  it('sorts numbers numerically, not lexically', () => {
    expect(ids(sortRows(rows, FIELDS, { key: 'amount', dir: 'asc' }))).toEqual(['2', '3', '1']);
    expect(ids(sortRows(rows, FIELDS, { key: 'amount', dir: 'desc' }))).toEqual(['1', '3', '2']);
  });

  it('sorts dates chronologically', () => {
    expect(ids(sortRows(rows, FIELDS, { key: 'joined', dir: 'asc' }))).toEqual(['2', '3', '1']);
  });

  it('never mutates the source array', () => {
    const original = [...rows];
    sortRows(rows, FIELDS, { key: 'amount', dir: 'desc' });
    expect(rows).toEqual(original);
  });

  it('keeps blanks last in both directions', () => {
    const asc = sortRows(rows, FIELDS, { key: 'nickname', dir: 'asc' });
    const desc = sortRows(rows, FIELDS, { key: 'nickname', dir: 'desc' });
    expect(asc[0].id).toBe('3');
    expect(desc[0].id).toBe('3');
    expect(ids(asc.slice(1)).sort()).toEqual(['1', '2']);
  });

  it('returns rows untouched for no sort or an unknown key', () => {
    expect(ids(sortRows(rows, FIELDS, null))).toEqual(['1', '2', '3']);
    expect(ids(sortRows(rows, FIELDS, { key: 'nope', dir: 'asc' }))).toEqual(['1', '2', '3']);
  });
});

describe('distinctValues', () => {
  it('lists each value once, sorted', () => {
    expect(distinctValues(rows, FIELDS[2])).toEqual(['ADMIN', 'RESIDENT']);
  });

  it('omits blanks so filters never offer an empty option', () => {
    expect(distinctValues(rows, FIELDS[5])).toEqual(['Bobby']);
  });
});

describe('applyListControls', () => {
  it('combines filter, search, and sort together', () => {
    const result = applyListControls(rows, FIELDS, {
      filters: { role: 'RESIDENT' },
      search: 'gmail',
      sort: { key: 'name', dir: 'asc' },
    });
    expect(ids(result)).toEqual(['3']);
  });

  it('applies the filter before the search, so both must match', () => {
    const result = applyListControls(rows, FIELDS, {
      filters: { role: 'ADMIN' },
      search: 'ana',
      sort: null,
    });
    expect(result).toEqual([]);
  });

  it('sorts the narrowed set, not the original', () => {
    const result = applyListControls(rows, FIELDS, {
      filters: { role: 'RESIDENT' },
      search: '',
      sort: { key: 'amount', dir: 'desc' },
    });
    expect(ids(result)).toEqual(['3', '2']);
  });

  it('is a no-op with empty controls', () => {
    const result = applyListControls(rows, FIELDS, { filters: {}, search: '', sort: null });
    expect(ids(result)).toEqual(['1', '2', '3']);
  });
});
