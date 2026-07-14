import { StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { ScreenContainer } from '@/components/ScreenContainer';
import { Card } from '@/components/Card';
import { ListCard } from '@/components/ListCard';
import { ListRow } from '@/components/ListRow';
import { LoadingView } from '@/components/LoadingView';
import { ErrorView } from '@/components/ErrorView';
import { EmptyState } from '@/components/EmptyState';
import { StatusBadge } from '@/components/StatusBadge';
import { useAuth } from '@/auth/AuthContext';
import { useApi } from '@/hooks/useApi';
import { getResidentDashboard } from '@/api/dashboard';
import { colors } from '@/theme';
import { formatCents, titleCase } from '@/utils/format';
import { violationStatusTone } from '@/utils/tones';

export default function ResidentDashboard() {
  const { user } = useAuth();
  const { data, loading, error, refreshing, refresh } = useApi(getResidentDashboard);

  if (loading) return <LoadingView />;
  if (error || !data) return <ErrorView message={error ?? undefined} onRetry={refresh} />;

  const hasBalance = data.balanceCents > 0;

  return (
    <ScreenContainer onRefresh={refresh} refreshing={refreshing}>
      <Text style={styles.greeting}>Welcome, {user?.firstName}</Text>

      <View style={styles.statRow}>
        <Card style={styles.statCard} onPress={() => router.push('/payments')}>
          <Text style={[styles.statValue, hasBalance && styles.danger]}>{formatCents(data.balanceCents)}</Text>
          <Text style={styles.statLabel}>Current Balance</Text>
        </Card>
        <Card style={styles.statCard} onPress={() => router.push('/issues')}>
          <Text style={styles.statValue}>{data.openIssues}</Text>
          <Text style={styles.statLabel}>Open Issues</Text>
        </Card>
      </View>

      <View style={styles.statRow}>
        <Card style={styles.statCard}>
          <Text style={styles.statValueSm}>{data.nextDueDateLabel ?? '—'}</Text>
          <Text style={styles.statLabel}>Next Due Date</Text>
          {data.nextDueAmountCents != null && (
            <Text style={styles.subtext}>{formatCents(data.nextDueAmountCents)}</Text>
          )}
        </Card>
        <Card style={styles.statCard} onPress={() => router.push('/more/architectural-requests')}>
          <Text style={styles.statValue}>{data.openArchRequests}</Text>
          <Text style={styles.statLabel}>Arch Requests</Text>
        </Card>
      </View>

      <Text style={styles.sectionTitle}>Active Violations</Text>
      {data.activeViolations.length === 0 ? (
        <Card>
          <EmptyState icon="✅" message="No active violations" />
        </Card>
      ) : (
        <ListCard>
          {data.activeViolations.map((v) => (
            <ListRow
              key={v.id}
              title={titleCase(v.violationType)}
              subtitle={v.date}
              right={<StatusBadge label={v.status} tone={violationStatusTone(v.status)} />}
              onPress={() => router.push(`/more/violations/${v.id}`)}
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
  statValue: { fontSize: 24, fontWeight: '700', color: colors.text },
  statValueSm: { fontSize: 16, fontWeight: '700', color: colors.text, textAlign: 'center' },
  statLabel: { fontSize: 13, color: colors.textMuted },
  subtext: { fontSize: 12, color: colors.textFaint },
  danger: { color: colors.danger },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: colors.text, marginTop: 8 },
});
