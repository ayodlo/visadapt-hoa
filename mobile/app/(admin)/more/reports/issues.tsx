import { StyleSheet, Text, View } from 'react-native';
import { ScreenContainer } from '@/components/ScreenContainer';
import { Card } from '@/components/Card';
import { ListCard } from '@/components/ListCard';
import { ListRow } from '@/components/ListRow';
import { LoadingView } from '@/components/LoadingView';
import { ErrorView } from '@/components/ErrorView';
import { useApi } from '@/hooks/useApi';
import { getIssuesReport } from '@/api/admin';
import { colors } from '@/theme';
import { titleCase } from '@/utils/format';

export default function IssuesReportScreen() {
  const { data, loading, error, refresh } = useApi(getIssuesReport);

  if (loading) return <LoadingView />;
  if (error || !data) return <ErrorView message={error ?? undefined} onRetry={refresh} />;

  return (
    <ScreenContainer>
      <View style={styles.statRow}>
        <Card style={styles.statCard}>
          <Text style={styles.statValue}>{data.summary.overdueCount}</Text>
          <Text style={styles.statLabel}>Overdue</Text>
        </Card>
        <Card style={styles.statCard}>
          <Text style={styles.statValue}>{data.summary.unassignedCount}</Text>
          <Text style={styles.statLabel}>Unassigned</Text>
        </Card>
      </View>
      <View style={styles.statRow}>
        <Card style={styles.statCard}>
          <Text style={styles.statValue}>{data.summary.createdLast30Days}</Text>
          <Text style={styles.statLabel}>Created (30d)</Text>
        </Card>
        <Card style={styles.statCard}>
          <Text style={styles.statValue}>{data.summary.resolvedLast30Days}</Text>
          <Text style={styles.statLabel}>Resolved (30d)</Text>
        </Card>
      </View>
      <Card style={styles.statCard}>
        <Text style={styles.statValue}>{data.summary.avgResolutionDays ?? '—'}</Text>
        <Text style={styles.statLabel}>Avg Resolution Days</Text>
      </Card>

      <Text style={styles.sectionTitle}>By Status</Text>
      <ListCard>
        {data.byStatus.map((s) => (
          <ListRow key={s.status} title={titleCase(s.status)} right={<Text style={styles.count}>{s.count}</Text>} />
        ))}
      </ListCard>

      <Text style={styles.sectionTitle}>By Category</Text>
      <ListCard>
        {data.byCategory.map((c) => (
          <ListRow key={c.category} title={titleCase(c.category)} right={<Text style={styles.count}>{c.count}</Text>} />
        ))}
      </ListCard>

      <Text style={styles.sectionTitle}>By Priority</Text>
      <ListCard>
        {data.byPriority.map((p) => (
          <ListRow key={p.priority} title={titleCase(p.priority)} right={<Text style={styles.count}>{p.count}</Text>} />
        ))}
      </ListCard>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  statRow: { flexDirection: 'row', gap: 12 },
  statCard: { flex: 1, alignItems: 'center', gap: 4 },
  statValue: { fontSize: 20, fontWeight: '700', color: colors.text },
  statLabel: { fontSize: 12, color: colors.textMuted, textAlign: 'center' },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: colors.text, marginTop: 8 },
  count: { fontSize: 14, fontWeight: '600', color: colors.text },
});
