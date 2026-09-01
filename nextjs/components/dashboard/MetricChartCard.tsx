'use client';

import { useState } from 'react';
import { ChartColumn, ChartLine, CircleHelp, Download, LoaderCircle, Minus, Table2, TrendingDown, TrendingUp } from 'lucide-react';
import { EmptyCard } from '@/components/ui/EmptyCard';
import { MetricTable } from './MetricTable';
import { TrendChart, type ChartType } from './TrendChart';
import {
  GRANULARITIES,
  GRANULARITY_LABELS,
  METRIC_META,
  formatMetricValue,
  periodChange,
} from '@/lib/metrics-shared';
import type { Granularity, RangePreset, TimeseriesResult } from '@/lib/metrics-shared';

interface Props {
  initial: TimeseriesResult;
  range: RangePreset;
  /** Bar suits per-period counts; line suits a running balance. */
  defaultChartType?: ChartType;
  emptyMessage: string;
}

const TOGGLE_BASE =
  'p-1.5 rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500';
const TOGGLE_ON = 'bg-blue-50 text-blue-600';
const TOGGLE_OFF = 'text-gray-400 hover:text-gray-600 hover:bg-gray-50';

export function MetricChartCard({ initial, range, defaultChartType = 'line', emptyMessage }: Props) {
  const [series, setSeries] = useState(initial);
  const [chartType, setChartType] = useState<ChartType>(defaultChartType);
  const [showTable, setShowTable] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const meta = METRIC_META[series.metric];
  const { points, valueKind } = series;
  const change = periodChange(points);

  // A running balance is meaningful at its latest point; a per-period flow is
  // not — the newest bucket is a partial period, so a fresh month would headline
  // "$0.00". Flows headline the range total instead.
  const hero = meta.cumulative
    ? points[points.length - 1]?.value
    : points.reduce((sum, p) => sum + p.value, 0);
  const hasHero = points.length > 0;

  async function selectGranularity(granularity: Granularity) {
    if (granularity === series.granularity || loading) return;
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams({ metric: series.metric, granularity, range });
      const res = await fetch(`/api/admin/metrics/timeseries?${params}`);
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? 'Could not load this period.');
        return;
      }
      setSeries(data);
    } catch {
      setError('Could not load this period.');
    } finally {
      setLoading(false);
    }
  }

  function exportCsv() {
    const rows = [
      ['Period', meta.title],
      ...points.map((p) => [p.label, valueKind === 'currency' ? (p.value / 100).toFixed(2) : String(p.value)]),
    ];
    const csv = rows.map((r) => r.join(',')).join('\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `${series.metric}-${series.granularity}-${range}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <section className="bg-white border border-gray-200 rounded-xl p-5" aria-labelledby={`${series.metric}-heading`}>
      <div className="flex items-start justify-between gap-3 mb-1 flex-wrap">
        <h2 id={`${series.metric}-heading`} className="text-base font-semibold text-gray-900">
          {meta.title}
        </h2>

        <div className="flex items-center gap-1">
          <div className="flex items-center gap-0.5 mr-1" role="group" aria-label="Chart type">
            <button
              type="button"
              onClick={() => { setChartType('line'); setShowTable(false); }}
              aria-pressed={!showTable && chartType === 'line'}
              aria-label="Line chart"
              className={`${TOGGLE_BASE} ${!showTable && chartType === 'line' ? TOGGLE_ON : TOGGLE_OFF}`}
            >
              <ChartLine className="w-4 h-4" aria-hidden="true" />
            </button>
            <button
              type="button"
              onClick={() => { setChartType('bar'); setShowTable(false); }}
              aria-pressed={!showTable && chartType === 'bar'}
              aria-label="Bar chart"
              className={`${TOGGLE_BASE} ${!showTable && chartType === 'bar' ? TOGGLE_ON : TOGGLE_OFF}`}
            >
              <ChartColumn className="w-4 h-4" aria-hidden="true" />
            </button>
            <button
              type="button"
              onClick={() => setShowTable(true)}
              aria-pressed={showTable}
              aria-label="Table view"
              className={`${TOGGLE_BASE} ${showTable ? TOGGLE_ON : TOGGLE_OFF}`}
            >
              <Table2 className="w-4 h-4" aria-hidden="true" />
            </button>
          </div>

          <div className="flex items-center gap-0.5 mr-1" role="group" aria-label="Period">
            {GRANULARITIES.map((g) => (
              <button
                key={g}
                type="button"
                onClick={() => selectGranularity(g)}
                aria-pressed={series.granularity === g}
                aria-label={GRANULARITY_LABELS[g].full}
                className={`px-2 py-1 text-xs font-medium rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                  series.granularity === g ? TOGGLE_ON : TOGGLE_OFF
                }`}
              >
                {GRANULARITY_LABELS[g].short}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={exportCsv}
            disabled={points.length === 0}
            aria-label="Download CSV"
            className={`${TOGGLE_BASE} ${TOGGLE_OFF} disabled:opacity-40`}
          >
            <Download className="w-4 h-4" aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={() => setShowHelp((v) => !v)}
            aria-expanded={showHelp}
            aria-label="About this metric"
            className={`${TOGGLE_BASE} ${showHelp ? TOGGLE_ON : TOGGLE_OFF}`}
          >
            <CircleHelp className="w-4 h-4" aria-hidden="true" />
          </button>
        </div>
      </div>

      {hasHero && (
        <div className="flex items-baseline gap-2 mb-3 flex-wrap">
          <span className="text-2xl font-bold text-gray-900">
            {formatMetricValue(hero, valueKind)}
          </span>
          {!meta.cumulative && <span className="text-xs text-gray-500">total in range</span>}
          {change && <TrendBadge delta={change.delta} pct={change.pct} inverted={meta.cumulative} />}
        </div>
      )}

      {showHelp && <p className="text-xs text-gray-500 mb-3">{meta.help}</p>}
      {error && (
        <p className="text-sm text-red-600 mb-3" role="alert">
          {error}
        </p>
      )}

      <div className={loading ? 'opacity-50 transition-opacity' : 'transition-opacity'} aria-busy={loading}>
        {points.length === 0 ? (
          <EmptyCard message={emptyMessage} />
        ) : showTable ? (
          <MetricTable points={points} valueKind={valueKind} valueLabel={meta.title} />
        ) : (
          <TrendChart points={points} valueKind={valueKind} chartType={chartType} title={meta.title} />
        )}
      </div>

      {loading && (
        <p className="flex items-center gap-1.5 text-xs text-gray-500 mt-2" role="status">
          <LoaderCircle className="w-3 h-3 animate-spin" aria-hidden="true" />
          Loading…
        </p>
      )}
    </section>
  );
}

/**
 * Period-over-period movement. `inverted` marks metrics where a rise is bad
 * (an unpaid balance going up), so the color follows meaning, not direction.
 */
function TrendBadge({ delta, pct, inverted }: { delta: number; pct: number | null; inverted: boolean }) {
  if (delta === 0) {
    return (
      <span className="flex items-center gap-1 text-xs font-medium text-gray-500">
        <Minus className="w-3 h-3" aria-hidden="true" />
        No change
      </span>
    );
  }

  const rising = delta > 0;
  const good = inverted ? !rising : rising;
  const Icon = rising ? TrendingUp : TrendingDown;
  const amount = pct === null ? 'new' : `${Math.abs(pct).toFixed(pct >= 100 ? 0 : 1)}%`;

  return (
    <span className={`flex items-center gap-1 text-xs font-medium ${good ? 'text-green-600' : 'text-red-600'}`}>
      <Icon className="w-3 h-3" aria-hidden="true" />
      {amount} {rising ? 'higher' : 'lower'} than previous period
    </span>
  );
}
