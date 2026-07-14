import { router } from 'expo-router';
import { ScreenContainer } from '@/components/ScreenContainer';
import { ListCard } from '@/components/ListCard';
import { ListRow } from '@/components/ListRow';
import { LoadingView } from '@/components/LoadingView';
import { ErrorView } from '@/components/ErrorView';
import { EmptyState } from '@/components/EmptyState';
import { StatusBadge } from '@/components/StatusBadge';
import { useApi } from '@/hooks/useApi';
import { listMyViolations } from '@/api/violations';
import { titleCase, formatDate } from '@/utils/format';
import { violationStatusTone } from '@/utils/tones';

export default function ViolationsList() {
  const { data, loading, error, refreshing, refresh } = useApi(listMyViolations);

  if (loading) return <LoadingView />;
  if (error || !data) return <ErrorView message={error ?? undefined} onRetry={refresh} />;

  return (
    <ScreenContainer onRefresh={refresh} refreshing={refreshing}>
      {data.violations.length === 0 ? (
        <EmptyState icon="✅" message="No violations on record" />
      ) : (
        <ListCard>
          {data.violations.map((v) => (
            <ListRow
              key={v.id}
              title={titleCase(v.violationType)}
              subtitle={formatDate(v.observedAt)}
              right={<StatusBadge label={v.status} tone={violationStatusTone(v.status)} />}
              onPress={() => router.push(`/more/violations/${v.id}`)}
            />
          ))}
        </ListCard>
      )}
    </ScreenContainer>
  );
}
