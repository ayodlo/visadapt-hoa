import { Pressable, StyleSheet, Text } from 'react-native';
import { router, Stack } from 'expo-router';
import { ScreenContainer } from '@/components/ScreenContainer';
import { ListCard } from '@/components/ListCard';
import { ListRow } from '@/components/ListRow';
import { LoadingView } from '@/components/LoadingView';
import { ErrorView } from '@/components/ErrorView';
import { EmptyState } from '@/components/EmptyState';
import { StatusBadge } from '@/components/StatusBadge';
import { useApi } from '@/hooks/useApi';
import { listMyArchRequests } from '@/api/architecturalRequests';
import { colors } from '@/theme';
import { titleCase, formatDate } from '@/utils/format';
import { archStatusTone } from '@/utils/tones';

export default function ArchRequestsList() {
  const { data, loading, error, refreshing, refresh } = useApi(listMyArchRequests);

  return (
    <>
      <Stack.Screen
        options={{
          headerRight: () => (
            <Pressable onPress={() => router.push('/more/architectural-requests/new')} hitSlop={12}>
              <Text style={styles.addButton}>+ New</Text>
            </Pressable>
          ),
        }}
      />
      {loading ? (
        <LoadingView />
      ) : error || !data ? (
        <ErrorView message={error ?? undefined} onRetry={refresh} />
      ) : (
        <ScreenContainer onRefresh={refresh} refreshing={refreshing}>
          {data.requests.length === 0 ? (
            <EmptyState icon="🏗️" message="No architectural requests yet. Tap + New to submit one." />
          ) : (
            <ListCard>
              {data.requests.map((r) => (
                <ListRow
                  key={r.id}
                  title={titleCase(r.requestType)}
                  subtitle={formatDate(r.createdAt)}
                  right={<StatusBadge label={r.status} tone={archStatusTone(r.status)} />}
                  onPress={() => router.push(`/more/architectural-requests/${r.id}`)}
                />
              ))}
            </ListCard>
          )}
        </ScreenContainer>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  addButton: { color: colors.primary, fontSize: 15, fontWeight: '600' },
});
