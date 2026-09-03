/**
 * Pure helpers for the searchable select: filtering and list virtualization.
 *
 * Kept out of the component so the behaviour that matters at scale — matching
 * and windowing — is unit-testable without rendering anything.
 */

export interface ComboOption {
  value: string;
  label: string;
  /** Secondary line, also searched (e.g. an email or unit address). */
  description?: string;
}

/**
 * Any list that can plausibly exceed this many entries gets a text filter
 * instead of a plain dropdown. Below it, a native select is easier to use.
 */
export const SEARCHABLE_THRESHOLD = 15;

/** Case-insensitive substring match across label and description. */
export function filterOptions(options: ComboOption[], query: string): ComboOption[] {
  const q = query.trim().toLowerCase();
  if (!q) return options;
  return options.filter(
    (o) =>
      o.label.toLowerCase().includes(q) ||
      (o.description ? o.description.toLowerCase().includes(q) : false)
  );
}

export interface ListWindow {
  /** First rendered index, inclusive. */
  start: number;
  /** Last rendered index, exclusive. */
  end: number;
  /** Spacer height standing in for the rows above `start`. */
  padTop: number;
  /** Spacer height standing in for the rows after `end`. */
  padBottom: number;
}

/**
 * Which slice of a long list is worth rendering.
 *
 * Only rows near the viewport are mounted; the rest are represented by two
 * spacer elements, so the scrollbar still reflects the full list. `overscan`
 * keeps a few rows beyond each edge so scrolling doesn't flash blank.
 */
export function computeWindow(
  total: number,
  scrollTop: number,
  viewportHeight: number,
  itemHeight: number,
  overscan = 4
): ListWindow {
  if (total <= 0 || itemHeight <= 0) return { start: 0, end: 0, padTop: 0, padBottom: 0 };

  const safeScroll = Math.max(0, Math.min(scrollTop, total * itemHeight));
  const firstVisible = Math.floor(safeScroll / itemHeight);
  const visibleCount = Math.ceil(viewportHeight / itemHeight) + 1;

  const start = Math.max(0, firstVisible - overscan);
  const end = Math.min(total, firstVisible + visibleCount + overscan);

  return {
    start,
    end,
    padTop: start * itemHeight,
    padBottom: Math.max(0, (total - end) * itemHeight),
  };
}

/**
 * Scroll offset that brings `index` just inside the viewport, or null when it
 * is already fully visible. Used to follow keyboard navigation without
 * yanking the list on every keystroke.
 */
export function scrollOffsetFor(
  index: number,
  scrollTop: number,
  viewportHeight: number,
  itemHeight: number
): number | null {
  const top = index * itemHeight;
  const bottom = top + itemHeight;
  if (top < scrollTop) return top;
  if (bottom > scrollTop + viewportHeight) return bottom - viewportHeight;
  return null;
}

/** Move the highlighted index, clamping at both ends rather than wrapping. */
export function nextActiveIndex(current: number, delta: number, total: number): number {
  if (total <= 0) return -1;
  if (current < 0) return delta > 0 ? 0 : total - 1;
  return Math.max(0, Math.min(total - 1, current + delta));
}
