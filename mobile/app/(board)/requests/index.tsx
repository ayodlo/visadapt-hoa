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
import { listBoardArchRequests } from '@/api/board';
import { colors } from '@/theme';
import { titleCase, formatDate } from '@/utils/format';
import { archStatusTone } from '@/utils/tones';

const STATUS_FILTERS: { value: string; label: string }[] = [
  { value: '', label: 'Needs Review' },
  { value: 'ALL', label: 'All' },
  { value: 'APPROVED', label: 'Approved' },
  { value: 'DENIED', label: 'Denied' },
];

export default function BoardArchRequestsList() {
  const [statusFilter, setStatusFilter] = useState('');

  const { data, loading, error, refreshing, refresh } = useApi(
    useCallback(() => {
      if (statusFilter === '') {
        // "Needs Review" isn't a single API status — fetch SUBMITTED requests,
        // which is the primary queue; UNDER_REVIEW ones show under "All".
        return listBoardArchRequests({ status: 'SUBMITTED' });
      }
      return listBoardArchRequests(statusFilter === 'ALL' ? {} : { status: statusFilter });
    }, [statusFilter])
  );

  return (
    <ScreenContainer onRefresh={refresh} refreshing={refreshing}>
      <ChipSelect options={STATUS_FILTERS} value={statusFilter} onChange={setStatusFilter} />

      {loading ? (
        <ActivityIndicator color={colors.primary} style={{ marginTop: 24 }} />
      ) : error || !data ? (
        <ErrorView message={error ?? undefined} onRetry={refresh} />
      ) : data.requests.length === 0 ? (
        <EmptyState icon="🏗️" message="No requests here right now" />
      ) : (
        <ListCard>
          {data.requests.map((r) => (
            <ListRow
              key={r.id}
              title={`${titleCase(r.requestType)} — ${r.resident.firstName} ${r.resident.lastName}`}
              subtitle={`${r.property?.streetAddress ?? 'No property'} · ${formatDate(r.createdAt)}`}
              right={<StatusBadge label={r.status} tone={archStatusTone(r.status)} />}
              onPress={() => router.push(`/requests/${r.id}`)}
            />
          ))}
        </ListCard>
      )}
    </ScreenContainer>
  );
}
