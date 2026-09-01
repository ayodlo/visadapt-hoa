'use client';

import type { ListControls } from '@/hooks/useListControls';
import type { ListField } from '@/lib/list-controls';

interface Props<T> {
  field: ListField<T>;
  controls: ListControls<T>;
  className?: string;
}

const TH_CLASS =
  'text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap';

/**
 * Column header that sorts on click. `aria-sort` on the cell announces the
 * current order, and the control itself is a real button so it is reachable and
 * operable by keyboard.
 */
export function SortableTh<T>({ field, controls, className = '' }: Props<T>) {
  const active = controls.sort?.key === field.key;
  const dir = controls.sort?.dir;

  return (
    <th
      scope="col"
      aria-sort={active ? (dir === 'asc' ? 'ascending' : 'descending') : 'none'}
      className={`${TH_CLASS} ${className}`}
    >
      <button
        type="button"
        onClick={() => controls.toggleSort(field.key)}
        className="flex items-center gap-1 uppercase tracking-wider hover:text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 rounded"
      >
        {field.label}
        <span aria-hidden="true" className={active ? 'text-blue-600' : 'text-gray-300'}>
          {active ? (dir === 'asc' ? '↑' : '↓') : '↕'}
        </span>
      </button>
    </th>
  );
}

/** Non-sortable header, styled to match `SortableTh`. */
export function PlainTh({ label, className = '' }: { label: string; className?: string }) {
  return (
    <th scope="col" className={`${TH_CLASS} ${className}`}>
      {label}
    </th>
  );
}
