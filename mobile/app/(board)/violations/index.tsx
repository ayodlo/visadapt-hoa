import { useCallback, useState } from 'react';
import { ActivityIndicator } from 'react-native';
import { router } from 'expo-router';
import { ScreenContainer } from '@/components/ScreenContainer';
import { ChipSelect } from '@/components/ChipSelect';
import { ListCard } from '@/components/ListCard';
import { ListRow } from '@/components/ListRow';
import { ErrorView } from '@/components/ErrorView';
import { EmptyState } from '@/components/EmptyState';
import { StatusBadge } from '@/components/StatusBadge';
import { useApi } from '@/hooks/useApi';
import { listAdminViolations } from '@/api/board';
import { colors } from '@/theme';
import { titleCase, formatDate } from '@/utils/format';
import { violationStatusTone } from '@/utils/tones';

const FILTERS: { value: 'escalated' | 'appeals'; label: string }[] = [
  { value: 'escalated', label: 'Escalated' },
  { value: 'appeals', label: 'Appeals' },
];

export default function BoardViolationsList() {
  const [filter, setFilter] = useState<'escalated' | 'appeals'>('escalated');

  const { data, loading, error, refreshing, refresh } = useApi(
    useCallback(
      () =>
        filter === 'escalated'
          ? listAdminViolations({ status: 'ESCALATED' })
          : listAdminViolations({ hasAppeal: true }),
      [filter]
    )
  );

  return (
    <ScreenContainer onRefresh={refresh} refreshing={refreshing}>
      <ChipSelect options={FILTERS} value={filter} onChange={setFilter} />

      {loading ? (
        <ActivityIndicator color={colors.primary} style={{ marginTop: 24 }} />
      ) : error || !data ? (
        <ErrorView message={error ?? undefined} onRetry={refresh} />
      ) : data.violations.length === 0 ? (
        <EmptyState icon="✅" message="Nothing here right now" />
      ) : (
        <ListCard>
          {data.violations.map((v) => (
            <ListRow
              key={v.id}
              title={`${titleCase(v.violationType)} — ${v.resident.firstName} ${v.resident.lastName}`}
              subtitle={`${v.property?.streetAddress ?? 'No property'} · ${formatDate(v.observedAt)}`}
              right={
                <StatusBadge
                  label={v.appeal && filter === 'appeals' ? v.appeal.status : v.status}
                  tone={violationStatusTone(v.status)}
                />
              }
              onPress={() => router.push(`/violations/${v.id}`)}
            />
          ))}
        </ListCard>
      )}
    </ScreenContainer>
  );
}
