import { router } from 'expo-router';
import { ScreenContainer } from '@/components/ScreenContainer';
import { ListCard } from '@/components/ListCard';
import { ListRow } from '@/components/ListRow';
import { LoadingView } from '@/components/LoadingView';
import { ErrorView } from '@/components/ErrorView';
import { EmptyState } from '@/components/EmptyState';
import { useApi } from '@/hooks/useApi';
import { listEvents } from '@/api/events';
import { formatDateTime } from '@/utils/format';

export function EventsListScreen() {
  const { data, loading, error, refreshing, refresh } = useApi(listEvents);

  if (loading) return <LoadingView />;
  if (error || !data) return <ErrorView message={error ?? undefined} onRetry={refresh} />;

  return (
    <ScreenContainer onRefresh={refresh} refreshing={refreshing}>
      {data.length === 0 ? (
        <EmptyState icon="📅" message="No upcoming events" />
      ) : (
        <ListCard>
          {data.map((e) => (
            <ListRow
              key={e.id}
              title={e.title}
              subtitle={`${formatDateTime(e.startAt)}${e.location ? ` · ${e.location}` : ''}`}
              onPress={() => router.push(`/more/events/${e.id}`)}
            />
          ))}
        </ListCard>
      )}
    </ScreenContainer>
  );
}
