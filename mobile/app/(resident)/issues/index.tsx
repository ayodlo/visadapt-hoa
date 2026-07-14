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
import { listMyIssues } from '@/api/issues';
import { colors } from '@/theme';
import { titleCase, formatDate } from '@/utils/format';
import { issueStatusTone } from '@/utils/tones';

export default function IssuesList() {
  const { data, loading, error, refreshing, refresh } = useApi(listMyIssues);

  return (
    <>
      <Stack.Screen
        options={{
          headerRight: () => (
            <Pressable onPress={() => router.push('/issues/new')} hitSlop={12}>
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
          {data.issues.length === 0 ? (
            <EmptyState icon="🔨" message="No issues reported yet. Tap + New to report one." />
          ) : (
            <ListCard>
              {data.issues.map((issue) => (
                <ListRow
                  key={issue.id}
                  title={issue.title}
                  subtitle={`${titleCase(issue.category)} · ${formatDate(issue.createdAt)}`}
                  right={<StatusBadge label={issue.status} tone={issueStatusTone(issue.status)} />}
                  onPress={() => router.push(`/issues/${issue.id}`)}
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
