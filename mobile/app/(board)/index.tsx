import { StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { ScreenContainer } from '@/components/ScreenContainer';
import { Card } from '@/components/Card';
import { ListCard } from '@/components/ListCard';
import { ListRow } from '@/components/ListRow';
import { LoadingView } from '@/components/LoadingView';
import { ErrorView } from '@/components/ErrorView';
import { EmptyState } from '@/components/EmptyState';
import { useAuth } from '@/auth/AuthContext';
import { useApi } from '@/hooks/useApi';
import { getBoardDashboard } from '@/api/board';
import { colors } from '@/theme';
import { formatCents } from '@/utils/format';

export default function BoardDashboard() {
  const { user } = useAuth();
  const { data, loading, error, refreshing, refresh } = useApi(getBoardDashboard);

  if (loading) return <LoadingView />;
  if (error || !data) return <ErrorView message={error ?? undefined} onRetry={refresh} />;

  return (
    <ScreenContainer onRefresh={refresh} refreshing={refreshing}>
      <Text style={styles.greeting}>Welcome, {user?.firstName}</Text>

      <View style={styles.statRow}>
        <Card style={styles.statCard}>
          <Text style={styles.statValue}>{formatCents(data.financialSummary.outstandingCents)}</Text>
          <Text style={styles.statLabel}>Outstanding</Text>
        </Card>
        <Card style={styles.statCard}>
          <Text style={styles.statValue}>{data.financialSummary.delinquentAccounts}</Text>
          <Text style={styles.statLabel}>Delinquent Accounts</Text>
        </Card>
      </View>

      <View style={styles.statRow}>
        <Card style={styles.statCard}>
          <Text style={styles.statValue}>{data.openIssues}</Text>
          <Text style={styles.statLabel}>Open Issues</Text>
        </Card>
        <Card style={styles.statCard}>
          <Text style={styles.statValue}>{data.resolvedThisMonth}</Text>
          <Text style={styles.statLabel}>Resolved This Month</Text>
        </Card>
      </View>

      <Text style={styles.sectionTitle}>Decision Queue</Text>
      {data.decisionQueueCount === 0 ? (
        <Card>
          <EmptyState icon="✅" message="Nothing needs your review right now" />
        </Card>
      ) : (
        <ListCard>
          {data.archRequestsNeedingReview > 0 && (
            <ListRow
              title="Architectural Requests"
              subtitle={`${data.archRequestsNeedingReview} awaiting review`}
              onPress={() => router.push('/requests')}
            />
          )}
          {data.violationsNeedingReview > 0 && (
            <ListRow
              title="Escalated Violations"
              subtitle={`${data.violationsNeedingReview} need attention`}
              onPress={() => router.push('/violations')}
            />
          )}
          {data.pendingAppeals > 0 && (
            <ListRow
              title="Violation Appeals"
              subtitle={`${data.pendingAppeals} pending review`}
              onPress={() => router.push('/violations')}
            />
          )}
        </ListCard>
      )}

      <Text style={styles.sectionTitle}>Recent Announcements</Text>
      {data.recentAnnouncements.length === 0 ? (
        <Card>
          <EmptyState icon="📢" message="No announcements yet" />
        </Card>
      ) : (
        <ListCard>
          {data.recentAnnouncements.map((a) => (
            <ListRow
              key={a.id}
              title={a.title}
              subtitle={a.date}
              onPress={() => router.push(`/more/announcements/${a.id}`)}
            />
          ))}
        </ListCard>
      )}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  greeting: { fontSize: 22, fontWeight: '700', color: colors.text, marginBottom: 4 },
  statRow: { flexDirection: 'row', gap: 12 },
  statCard: { flex: 1, alignItems: 'center', gap: 4 },
  statValue: { fontSize: 22, fontWeight: '700', color: colors.text },
  statLabel: { fontSize: 12, color: colors.textMuted, textAlign: 'center' },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: colors.text, marginTop: 8 },
});
