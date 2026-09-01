'use client';

import { SearchInput } from './SearchInput';
import { FilterSelect } from './FilterSelect';
import type { ListControls } from '@/hooks/useListControls';

interface Props<T> {
  controls: ListControls<T>;
  searchPlaceholder?: string;
  /** Card lists have no column headers to click, so they get a sort dropdown. */
  showSort?: boolean;
  /** Noun for the result count, e.g. "resident" → "3 of 12 residents". */
  noun?: string;
  /** Override when adding "s" is wrong, e.g. "community" → "communities". */
  nounPlural?: string;
}

/**
 * Search, per-column filters, and (optionally) a sort control for a list view.
 * All three combine: filters narrow first, then search, then sort.
 */
export function ListToolbar<T>({
  controls,
  searchPlaceholder = 'Search…',
  showSort = false,
  noun = 'result',
  nounPlural,
}: Props<T>) {
  const { search, setSearch, filters, setFilter, filterOptions, sortableFields, sort } = controls;
  const shown = controls.visible.length;

  return (
    <div className="mb-4">
      <div className="flex flex-wrap items-center gap-2">
        <SearchInput
          id="list-search"
          value={search}
          onChange={setSearch}
          placeholder={searchPlaceholder}
          className="min-w-[16rem] flex-1"
        />

        {filterOptions.map(({ field, values }) => (
          <FilterSelect
            key={field.key}
            id={`filter-${field.key}`}
            label={field.label}
            value={filters[field.key] ?? ''}
            onChange={(value) => setFilter(field.key, value)}
            // Just "All" — the select's own label already names the column, and
            // pluralising arbitrary headers produces things like "All statuss".
            options={[{ label: 'All', value: '' }, ...values.map((v) => ({ label: v, value: v }))]}
          />
        ))}

        {showSort && sortableFields.length > 0 && (
          <>
            <FilterSelect
              id="list-sort"
              label="Sort"
              value={sort?.key ?? ''}
              onChange={(key) => (key ? controls.toggleSort(key) : controls.reset())}
              options={[
                { label: 'Default', value: '' },
                ...sortableFields.map((f) => ({ label: f.label, value: f.key })),
              ]}
            />
            {sort && (
              <button
                type="button"
                onClick={() => controls.toggleSort(sort.key)}
                aria-label={`Sort ${sort.dir === 'asc' ? 'descending' : 'ascending'}`}
                className="text-sm border border-gray-300 rounded-lg px-3 py-2 bg-white text-gray-600 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {sort.dir === 'asc' ? '↑ Asc' : '↓ Desc'}
              </button>
            )}
          </>
        )}

        {controls.active && (
          <button
            type="button"
            onClick={controls.reset}
            className="text-sm text-blue-600 hover:underline px-2 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 rounded"
          >
            Clear
          </button>
        )}
      </div>

      {controls.active && (
        <p className="text-xs text-gray-500 mt-2" role="status">
          {shown} of {controls.total} {controls.total === 1 ? noun : (nounPlural ?? `${noun}s`)}
        </p>
      )}
    </div>
  );
}
