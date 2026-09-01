import { formatMetricValue } from '@/lib/metrics-shared';
import type { MetricPoint, ValueKind } from '@/lib/metrics-shared';

interface Props {
  points: MetricPoint[];
  valueKind: ValueKind;
  /** Column heading for the value column, e.g. "Unpaid Balance". */
  valueLabel: string;
}

/**
 * Table view of a trend series. Doubles as the accessible alternative to the
 * chart, so the numbers behind any card are always reachable as text.
 */
export function MetricTable({ points, valueKind, valueLabel }: Props) {
  return (
    <div className="h-56 overflow-y-auto">
      <table className="w-full text-sm">
        <caption className="sr-only">{valueLabel} by period</caption>
        <thead className="sticky top-0 bg-white">
          <tr className="border-b border-gray-200">
            <th scope="col" className="text-left font-medium text-gray-500 py-2">
              Period
            </th>
            <th scope="col" className="text-right font-medium text-gray-500 py-2">
              {valueLabel}
            </th>
          </tr>
        </thead>
        <tbody>
          {points.map((point) => (
            <tr key={point.bucket} className="border-b border-gray-100 last:border-0">
              <th scope="row" className="text-left font-normal text-gray-600 py-2">
                {point.label}
              </th>
              <td className="text-right font-medium text-gray-900 py-2 tabular-nums">
                {formatMetricValue(point.value, valueKind)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
