'use client';

import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { Check, ChevronDown, X } from 'lucide-react';
import {
  computeWindow,
  filterOptions,
  nextActiveIndex,
  scrollOffsetFor,
  type ComboOption,
} from '@/lib/combobox';

/** Row height in px — must match the `h-9` on each option. */
const ITEM_HEIGHT = 36;
/** Listbox viewport height in px — `max-h-72`. */
const LIST_HEIGHT = 288;
/** Below this many rows, windowing costs more than it saves. */
const VIRTUALIZE_ABOVE = 40;

interface Props {
  id: string;
  options: ComboOption[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  /** Accessible name when there is no visible <label htmlFor={id}>. */
  ariaLabel?: string;
  disabled?: boolean;
  /** Shown when the filter matches nothing. */
  emptyMessage?: string;
  className?: string;
}

/**
 * Searchable single-select following the ARIA combobox pattern.
 *
 * Long option lists are virtualized — only the rows near the viewport are
 * mounted — so a community with thousands of residents stays responsive.
 * Because the DOM holds a slice rather than the whole list, each option carries
 * aria-posinset/aria-setsize so assistive tech still reports true positions.
 */
export function SearchableSelect({
  id,
  options,
  value,
  onChange,
  placeholder = 'Search…',
  ariaLabel,
  disabled = false,
  emptyMessage = 'No matches',
  className = '',
}: Props) {
  const listboxId = useId();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(-1);
  const [scrollTop, setScrollTop] = useState(0);

  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const selected = useMemo(() => options.find((o) => o.value === value) ?? null, [options, value]);
  const matches = useMemo(() => filterOptions(options, query), [options, query]);

  const virtualize = matches.length > VIRTUALIZE_ABOVE;
  const win = virtualize
    ? computeWindow(matches.length, scrollTop, LIST_HEIGHT, ITEM_HEIGHT)
    : { start: 0, end: matches.length, padTop: 0, padBottom: 0 };

  // Close when focus or a click leaves the component.
  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) close();
    }
    document.addEventListener('mousedown', onPointerDown);
    return () => document.removeEventListener('mousedown', onPointerDown);
  }, [open]);

  // Keep the highlighted row inside the scroll viewport during keyboard use.
  useEffect(() => {
    if (!open || activeIndex < 0 || !listRef.current) return;
    const offset = scrollOffsetFor(activeIndex, listRef.current.scrollTop, LIST_HEIGHT, ITEM_HEIGHT);
    if (offset !== null) listRef.current.scrollTop = offset;
  }, [activeIndex, open]);

  function openList() {
    if (disabled) return;
    setOpen(true);
    setActiveIndex(selected ? matches.findIndex((o) => o.value === selected.value) : -1);
  }

  function close() {
    setOpen(false);
    setQuery('');
    setActiveIndex(-1);
    setScrollTop(0);
  }

  function choose(option: ComboOption) {
    onChange(option.value);
    close();
    inputRef.current?.focus();
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (disabled) return;

    if (!open && (e.key === 'ArrowDown' || e.key === 'Enter')) {
      e.preventDefault();
      openList();
      return;
    }
    if (!open) return;

    switch (e.key) {
      case 'ArrowDown':
      case 'ArrowUp':
        e.preventDefault();
        setActiveIndex((i) => nextActiveIndex(i, e.key === 'ArrowDown' ? 1 : -1, matches.length));
        break;
      case 'Home':
        e.preventDefault();
        setActiveIndex(matches.length ? 0 : -1);
        break;
      case 'End':
        e.preventDefault();
        setActiveIndex(matches.length - 1);
        break;
      case 'Enter':
        e.preventDefault();
        if (activeIndex >= 0 && matches[activeIndex]) choose(matches[activeIndex]);
        break;
      case 'Escape':
        e.preventDefault();
        close();
        break;
      case 'Tab':
        close();
        break;
    }
  }

  const activeId = activeIndex >= 0 && matches[activeIndex] ? `${listboxId}-opt-${activeIndex}` : undefined;
  // Closed: show the selection. Open: show what the user is typing.
  const inputValue = open ? query : selected?.label ?? '';

  return (
    <div ref={rootRef} className={`relative ${className}`}>
      <div className="relative">
        <input
          ref={inputRef}
          id={id}
          type="text"
          role="combobox"
          aria-expanded={open}
          aria-controls={listboxId}
          aria-autocomplete="list"
          aria-activedescendant={activeId}
          aria-label={ariaLabel}
          autoComplete="off"
          disabled={disabled}
          value={inputValue}
          placeholder={selected && !open ? selected.label : placeholder}
          onChange={(e) => {
            if (!open) setOpen(true);
            setQuery(e.target.value);
            setActiveIndex(0);
            setScrollTop(0);
            if (listRef.current) listRef.current.scrollTop = 0;
          }}
          onFocus={openList}
          onKeyDown={onKeyDown}
          className="w-full border border-gray-300 rounded-lg pl-3 pr-14 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-60 disabled:cursor-not-allowed"
        />

        <div className="absolute inset-y-0 right-1 flex items-center gap-0.5">
          {selected && !disabled && (
            <button
              type="button"
              onClick={() => { onChange(''); close(); inputRef.current?.focus(); }}
              aria-label="Clear selection"
              className="p-1 text-gray-400 hover:text-gray-600 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <X className="w-3.5 h-3.5" aria-hidden="true" />
            </button>
          )}
          <button
            type="button"
            tabIndex={-1}
            aria-hidden="true"
            disabled={disabled}
            onClick={() => (open ? close() : (inputRef.current?.focus(), openList()))}
            className="p-1 text-gray-400"
          >
            <ChevronDown className={`w-4 h-4 transition-transform ${open ? 'rotate-180' : ''}`} />
          </button>
        </div>
      </div>

      {open && (
        <div
          ref={listRef}
          id={listboxId}
          role="listbox"
          aria-label={ariaLabel}
          onScroll={(e) => virtualize && setScrollTop(e.currentTarget.scrollTop)}
          style={{ maxHeight: LIST_HEIGHT }}
          className="absolute z-20 mt-1 w-full overflow-y-auto bg-white border border-gray-200 rounded-lg shadow-lg"
        >
          {matches.length === 0 ? (
            <p className="px-3 py-2 text-sm text-gray-500">{emptyMessage}</p>
          ) : (
            <>
              {win.padTop > 0 && <div style={{ height: win.padTop }} aria-hidden="true" />}
              {matches.slice(win.start, win.end).map((option, i) => {
                const index = win.start + i;
                const isActive = index === activeIndex;
                const isSelected = option.value === value;
                return (
                  <div
                    key={option.value}
                    id={`${listboxId}-opt-${index}`}
                    role="option"
                    aria-selected={isSelected}
                    aria-posinset={index + 1}
                    aria-setsize={matches.length}
                    // Keep focus in the input so typing continues to work.
                    onMouseDown={(e) => e.preventDefault()}
                    onMouseEnter={() => setActiveIndex(index)}
                    onClick={() => choose(option)}
                    style={{ height: ITEM_HEIGHT }}
                    className={`flex items-center gap-2 px-3 cursor-pointer text-sm ${
                      isActive ? 'bg-blue-50' : ''
                    }`}
                  >
                    <Check
                      className={`w-3.5 h-3.5 flex-shrink-0 ${isSelected ? 'text-blue-600' : 'invisible'}`}
                      aria-hidden="true"
                    />
                    <span className="truncate text-gray-900">{option.label}</span>
                    {option.description && (
                      <span className="truncate text-xs text-gray-500 ml-auto">{option.description}</span>
                    )}
                  </div>
                );
              })}
              {win.padBottom > 0 && <div style={{ height: win.padBottom }} aria-hidden="true" />}
            </>
          )}
        </div>
      )}
    </div>
  );
}
