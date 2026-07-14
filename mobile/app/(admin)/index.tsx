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
import { getAdminDashboard } from '@/api/admin';
import { colors } from '@/theme';
import { formatCents, formatDateTime, titleCase } from '@/utils/format';

export default function AdminDashboard() {
  const { user } = useAuth();
  const { data, loading, error, refreshing, refresh } = useApi(getAdminDashboard);

  if (loading) return <LoadingView />;
  if (error || !data) return <ErrorView message={error ?? undefined} onRetry={refresh} />;

  return (
    <ScreenContainer onRefresh={refresh} refreshing={refreshing}>
      <Text style={styles.greeting}>Welcome, {user?.firstName}</Text>

      <View style={styles.statRow}>
        <Card style={styles.statCard}>
          <Text style={styles.statValue}>{data.totalResidents}</Text>
          <Text style={styles.statLabel}>Total Residents</Text>
        </Card>
        <Card style={styles.statCard}>
          <Text style={[styles.statValue, data.unpaidBalanceCents > 0 && styles.danger]}>
            {formatCents(data.unpaidBalanceCents)}
          </Text>
          <Text style={styles.statLabel}>Unpaid Balance</Text>
        </Card>
      </View>

      <View style={styles.statRow}>
        <Card style={styles.statCard} onPress={() => router.push('/issues')}>
          <Text style={styles.statValue}>{data.openIssues}</Text>
          <Text style={styles.statLabel}>Open Issues</Text>
        </Card>
        <Card style={styles.statCard}>
          <Text style={[styles.statValue, data.overdueIssues > 0 && styles.danger]}>{data.overdueIssues}</Text>
          <Text style={styles.statLabel}>Overdue Issues</Text>
        </Card>
      </View>

      <View style={styles.statRow}>
        <Card style={styles.statCard} onPress={() => router.push('/violations')}>
          <Text style={styles.statValue}>{data.openViolations}</Text>
          <Text style={styles.statLabel}>Open Violations</Text>
        </Card>
        <Card style={styles.statCard}>
          <Text style={styles.statValue}>{data.pendingAppeals}</Text>
          <Text style={styles.statLabel}>Pending Appeals</Text>
        </Card>
      </View>

      <View style={styles.statRow}>
        <Card style={styles.statCard}>
          <Text style={styles.statValue}>{data.openArchRequests}</Text>
          <Text style={styles.statLabel}>Open Arch Requests</Text>
        </Card>
        <Card style={styles.statCard}>
          <Text style={styles.statValue}>{data.avgResolutionDays ?? '—'}</Text>
          <Text style={styles.statLabel}>Avg Resolution (days)</Text>
        </Card>
      </View>

      <Text style={styles.sectionTitle}>Issues by Status</Text>
      {data.issuesByStatus.length === 0 ? (
        <Card>
          <EmptyState icon="✅" message="No issues" />
        </Card>
      ) : (
        <ListCard>
          {data.issuesByStatus.map((s) => (
            <ListRow key={s.status} title={titleCase(s.status)} right={<Text style={styles.count}>{s.count}</Text>} />
          ))}
        </ListCard>
      )}

      <Text style={styles.sectionTitle}>Recent Activity</Text>
      {data.recentActivity.length === 0 ? (
        <Card>
          <EmptyState icon="📋" message="No recent activity" />
        </Card>
      ) : (
        <ListCard>
          {data.recentActivity.map((a) => (
            <ListRow
              key={a.id}
              title={`${a.actorName ?? 'System'} ${a.action.replace(/_/g, ' ')} — ${a.issueTitle}`}
              subtitle={formatDateTime(a.createdAt)}
              onPress={() => router.push(`/issues/${a.issueId}`)}
            />
          ))}
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
  statValue: { fontSize: 20, fontWeight: '700', color: colors.text },
  statLabel: { fontSize: 12, color: colors.textMuted, textAlign: 'center' },
  danger: { color: colors.danger },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: colors.text, marginTop: 8 },
  count: { fontSize: 14, fontWeight: '600', color: colors.text },
});
