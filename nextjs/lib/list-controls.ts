/**
 * Generic search / filter / sort engine for list views.
 *
 * A list describes its columns once as `ListField[]`; searching, filtering, and
 * sorting all derive from that single description, so a new column becomes
 * searchable, filterable, and sortable without extra wiring.
 *
 * Pure and Prisma-free — safe to import from client components.
 */

export type FieldType = 'text' | 'number' | 'date';

export interface ListField<T> {
  key: string;
  /** Column header and filter/sort label. */
  label: string;
  /** Defaults to 'text'. Drives comparison order, not display. */
  type?: FieldType;
  /** Raw value used for sorting. */
  value: (row: T) => string | number | Date | null | undefined;
  /**
   * Display text used for searching and for filter options. Defaults to the
   * stringified `value`, which is right for most columns.
   */
  text?: (row: T) => string;
  /** Offer a dropdown of the distinct values in this column. */
  filterable?: boolean;
  /** Defaults to true. */
  sortable?: boolean;
}

export interface SortState {
  key: string;
  dir: 'asc' | 'desc';
}

export interface ListQuery {
  search: string;
  /** Field key → exact display text to match. Empty string means "all". */
  filters: Record<string, string>;
  sort: SortState | null;
}

/** Display text for a field, falling back to the raw value. */
export function fieldText<T>(field: ListField<T>, row: T): string {
  if (field.text) return field.text(row);
  const raw = field.value(row);
  if (raw === null || raw === undefined) return '';
  if (raw instanceof Date) return raw.toLocaleDateString();
  return String(raw);
}

/** Case-insensitive substring match against every field's text. */
export function searchRows<T>(rows: T[], fields: ListField<T>[], search: string): T[] {
  const query = search.trim().toLowerCase();
  if (!query) return rows;
  return rows.filter((row) =>
    fields.some((field) => fieldText(field, row).toLowerCase().includes(query))
  );
}

/** Exact match per filtered field; multiple active filters combine with AND. */
export function filterRows<T>(
  rows: T[],
  fields: ListField<T>[],
  filters: Record<string, string>
): T[] {
  const active = Object.entries(filters).filter(([, value]) => value !== '');
  if (active.length === 0) return rows;

  return rows.filter((row) =>
    active.every(([key, value]) => {
      const field = fields.find((f) => f.key === key);
      // An unknown key must not silently pass every row through.
      if (!field) return false;
      return fieldText(field, row) === value;
    })
  );
}

function compare<T>(field: ListField<T>, a: T, b: T): number {
  const left = field.value(a);
  const right = field.value(b);

  // Blanks sort last in both directions, so a descending sort doesn't open
  // with a wall of empty cells.
  const leftBlank = left === null || left === undefined || left === '';
  const rightBlank = right === null || right === undefined || right === '';
  if (leftBlank || rightBlank) return leftBlank && rightBlank ? 0 : leftBlank ? 1 : -1;

  switch (field.type) {
    case 'number':
      return Number(left) - Number(right);
    case 'date':
      return new Date(left as string | Date).getTime() - new Date(right as string | Date).getTime();
    default:
      return String(left).localeCompare(String(right), undefined, { sensitivity: 'base' });
  }
}

/** Returns a new array — never sorts the source in place. */
export function sortRows<T>(rows: T[], fields: ListField<T>[], sort: SortState | null): T[] {
  if (!sort) return rows;
  const field = fields.find((f) => f.key === sort.key);
  if (!field) return rows;

  const sorted = [...rows].sort((a, b) => compare(field, a, b));
  // Blanks were pushed last by `compare`; reversing would drag them to the top.
  if (sort.dir === 'desc') {
    const blank = (row: T) => {
      const v = field.value(row);
      return v === null || v === undefined || v === '';
    };
    const present = sorted.filter((r) => !blank(r)).reverse();
    return [...present, ...sorted.filter(blank)];
  }
  return sorted;
}

/** Distinct display values for a column, in sort order — the filter options. */
export function distinctValues<T>(rows: T[], field: ListField<T>): string[] {
  const seen = new Set<string>();
  for (const row of rows) {
    const text = fieldText(field, row);
    if (text !== '') seen.add(text);
  }
  return [...seen].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
}

/** Filter, then search, then sort. */
export function applyListControls<T>(
  rows: T[],
  fields: ListField<T>[],
  { search, filters, sort }: ListQuery
): T[] {
  return sortRows(searchRows(filterRows(rows, fields, filters), fields, search), fields, sort);
}
