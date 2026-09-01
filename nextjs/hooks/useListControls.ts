'use client';

import { useMemo, useState } from 'react';
import {
  applyListControls,
  distinctValues,
  type ListField,
  type SortState,
} from '@/lib/list-controls';

export interface ListControls<T> {
  search: string;
  setSearch: (value: string) => void;
  filters: Record<string, string>;
  setFilter: (key: string, value: string) => void;
  sort: SortState | null;
  /** Sort by a column; clicking the active column flips direction. */
  toggleSort: (key: string) => void;
  /** Rows after filtering, searching, and sorting. */
  visible: T[];
  /** Distinct filter options per filterable field key. */
  filterOptions: { field: ListField<T>; values: string[] }[];
  sortableFields: ListField<T>[];
  /** True when any search text or filter is applied. */
  active: boolean;
  reset: () => void;
  total: number;
}

/**
 * Client-side search / filter / sort over an already-loaded list.
 *
 * These screens each fetch their full collection up front, so filtering here
 * keeps the interaction instant and avoids a round trip per keystroke. If a
 * collection ever outgrows a single response, the field descriptors are the
 * natural thing to translate into server-side query params.
 */
export function useListControls<T>(
  rows: T[],
  fields: ListField<T>[],
  initialSort: SortState | null = null
): ListControls<T> {
  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [sort, setSort] = useState<SortState | null>(initialSort);

  const visible = useMemo(
    () => applyListControls(rows, fields, { search, filters, sort }),
    [rows, fields, search, filters, sort]
  );

  // Options come from the unfiltered rows so a filter never hides its own
  // alternatives and strand the user on a single choice.
  const filterOptions = useMemo(
    () =>
      fields
        .filter((f) => f.filterable)
        .map((field) => ({ field, values: distinctValues(rows, field) })),
    [rows, fields]
  );

  const sortableFields = useMemo(() => fields.filter((f) => f.sortable !== false), [fields]);

  function setFilter(key: string, value: string) {
    setFilters((prev) => ({ ...prev, [key]: value }));
  }

  function toggleSort(key: string) {
    setSort((prev) =>
      prev?.key === key ? { key, dir: prev.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'asc' }
    );
  }

  function reset() {
    setSearch('');
    setFilters({});
    setSort(initialSort);
  }

  const active = search.trim() !== '' || Object.values(filters).some((v) => v !== '');

  return {
    search,
    setSearch,
    filters,
    setFilter,
    sort,
    toggleSort,
    visible,
    filterOptions,
    sortableFields,
    active,
    reset,
    total: rows.length,
  };
}
