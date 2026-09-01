'use client';

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { formatAxisValue, formatMetricValue } from '@/lib/metrics-shared';
import type { MetricPoint, ValueKind } from '@/lib/metrics-shared';

export type ChartType = 'line' | 'bar';

interface Props {
  points: MetricPoint[];
  valueKind: ValueKind;
  chartType: ChartType;
  /** Names the single series; used for the accessible description. */
  title: string;
}

interface TooltipPayload {
  active?: boolean;
  payload?: { payload: MetricPoint }[];
}

function ChartTooltip({ active, payload, valueKind }: TooltipPayload & { valueKind: ValueKind }) {
  if (!active || !payload?.length) return null;
  const point = payload[0].payload;
  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-sm px-3 py-2">
      <p className="text-xs text-gray-500">{point.label}</p>
      <p className="text-sm font-semibold text-gray-900">
        {formatMetricValue(point.value, valueKind)}
      </p>
    </div>
  );
}

/**
 * The only module in the app that imports `recharts`. Props are plain data, so
 * swapping the rendering library out touches this file and nothing else.
 */
export function TrendChart({ points, valueKind, chartType, title }: Props) {
  const axisTick = { fill: 'var(--chart-axis)', fontSize: 12 };
  const summary = `${title} from ${points[0]?.label ?? ''} to ${points[points.length - 1]?.label ?? ''}`;

  const shared = (
    <>
      <CartesianGrid stroke="var(--chart-grid)" strokeDasharray="3 3" vertical={false} />
      <XAxis dataKey="label" tick={axisTick} tickLine={false} axisLine={{ stroke: 'var(--chart-grid)' }} />
      <YAxis
        tick={axisTick}
        tickLine={false}
        axisLine={false}
        width={64}
        tickFormatter={(value: number) => formatAxisValue(value, valueKind)}
      />
      <Tooltip
        cursor={{ stroke: 'var(--chart-axis)', strokeDasharray: '3 3' }}
        content={<ChartTooltip valueKind={valueKind} />}
      />
    </>
  );

  return (
    // Recharts renders the series; the table view behind the card's toggle is
    // the accessible equivalent, so the figure is labelled and not read as data.
    <figure className="w-full h-56" aria-label={summary}>
      <ResponsiveContainer width="100%" height="100%">
        {chartType === 'bar' ? (
          <BarChart data={points} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
            {shared}
            <Bar dataKey="value" fill="var(--chart-series)" radius={[4, 4, 0, 0]} maxBarSize={48} />
          </BarChart>
        ) : (
          <AreaChart data={points} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
            {shared}
            <Area
              type="monotone"
              dataKey="value"
              stroke="var(--chart-series)"
              strokeWidth={2}
              fill="var(--chart-series-fill)"
              dot={false}
              activeDot={{ r: 4, strokeWidth: 0 }}
            />
          </AreaChart>
        )}
      </ResponsiveContainer>
    </figure>
  );
}
