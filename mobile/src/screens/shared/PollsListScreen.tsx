import { router } from 'expo-router';
import { ScreenContainer } from '@/components/ScreenContainer';
import { ListCard } from '@/components/ListCard';
import { ListRow } from '@/components/ListRow';
import { LoadingView } from '@/components/LoadingView';
import { ErrorView } from '@/components/ErrorView';
import { EmptyState } from '@/components/EmptyState';
import { useApi } from '@/hooks/useApi';
import { listPolls } from '@/api/polls';

export function PollsListScreen() {
  const { data, loading, error, refreshing, refresh } = useApi(listPolls);

  if (loading) return <LoadingView />;
  if (error || !data) return <ErrorView message={error ?? undefined} onRetry={refresh} />;

  return (
    <ScreenContainer onRefresh={refresh} refreshing={refreshing}>
      {data.length === 0 ? (
        <EmptyState icon="🗳️" message="No polls right now" />
      ) : (
        <ListCard>
          {data.map((p) => (
            <ListRow
              key={p.id}
              title={p.question}
              subtitle={`${p._count.votes} ${p._count.votes === 1 ? 'vote' : 'votes'}${p.closesAt ? ' · closes ' + new Date(p.closesAt).toLocaleDateString() : ''}`}
              onPress={() => router.push(`/more/polls/${p.id}`)}
            />
          ))}
        </ListCard>
      )}
    </ScreenContainer>
  );
}
