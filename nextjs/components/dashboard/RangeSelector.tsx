import Link from 'next/link';
import { RANGE_LABELS, RANGE_PRESETS } from '@/lib/metrics-shared';
import type { RangePreset } from '@/lib/metrics-shared';

interface Props {
  active: RangePreset;
  /** Route the presets link back to, e.g. `/admin/dashboard`. */
  basePath: string;
}

/**
 * Date-range presets for the dashboard trend charts. Plain links so the range
 * stays in the URL — shareable, bookmarkable, and server-rendered.
 */
export function RangeSelector({ active, basePath }: Props) {
  return (
    <div className="flex items-center gap-1" role="group" aria-label="Date range">
      {RANGE_PRESETS.map((preset) => {
        const selected = preset === active;
        return (
          <Link
            key={preset}
            href={`${basePath}?range=${preset}`}
            aria-current={selected ? 'true' : undefined}
            className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 ${
              selected
                ? 'bg-blue-50 text-blue-600'
                : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
            }`}
          >
            {RANGE_LABELS[preset]}
          </Link>
        );
      })}
    </div>
  );
}
