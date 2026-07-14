import { View } from 'react-native';
import { router } from 'expo-router';
import { ScreenContainer } from '@/components/ScreenContainer';
import { ListCard } from '@/components/ListCard';
import { ListRow } from '@/components/ListRow';
import { LoadingView } from '@/components/LoadingView';
import { ErrorView } from '@/components/ErrorView';
import { EmptyState } from '@/components/EmptyState';
import { StatusBadge } from '@/components/StatusBadge';
import { useApi } from '@/hooks/useApi';
import { listAnnouncements } from '@/api/announcements';
import { formatDate } from '@/utils/format';
import { announcementPriorityTone } from '@/utils/tones';

// Shared between (resident) and (board) — announcements are audience-filtered
// server-side per the caller's role, so the same list/detail UI works for both.
export function AnnouncementsListScreen() {
  const { data, loading, error, refreshing, refresh } = useApi(listAnnouncements);

  if (loading) return <LoadingView />;
  if (error || !data) return <ErrorView message={error ?? undefined} onRetry={refresh} />;

  return (
    <ScreenContainer onRefresh={refresh} refreshing={refreshing}>
      {data.announcements.length === 0 ? (
        <EmptyState icon="📢" message="No announcements yet" />
      ) : (
        <ListCard>
          {data.announcements.map((a) => (
            <ListRow
              key={a.id}
              title={(a.isRead ? '' : '● ') + a.title}
              subtitle={formatDate(a.publishAt)}
              right={
                a.priority !== 'NORMAL' ? (
                  <View>
                    <StatusBadge label={a.priority} tone={announcementPriorityTone(a.priority)} />
                  </View>
                ) : undefined
              }
              onPress={() => router.push(`/more/announcements/${a.id}`)}
            />
          ))}
        </ListCard>
      )}
    </ScreenContainer>
  );
}
