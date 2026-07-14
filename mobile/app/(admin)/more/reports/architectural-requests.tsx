import { StyleSheet, Text, View } from 'react-native';
import { ScreenContainer } from '@/components/ScreenContainer';
import { Card } from '@/components/Card';
import { ListCard } from '@/components/ListCard';
import { ListRow } from '@/components/ListRow';
import { LoadingView } from '@/components/LoadingView';
import { ErrorView } from '@/components/ErrorView';
import { useApi } from '@/hooks/useApi';
import { getArchRequestsReport } from '@/api/admin';
import { colors } from '@/theme';
import { titleCase } from '@/utils/format';

export default function ArchRequestsReportScreen() {
  const { data, loading, error, refresh } = useApi(getArchRequestsReport);

  if (loading) return <LoadingView />;
  if (error || !data) return <ErrorView message={error ?? undefined} onRetry={refresh} />;

  return (
    <ScreenContainer>
      <View style={styles.statRow}>
        <Card style={styles.statCard}>
          <Text style={styles.statValue}>{data.summary.submittedLast30Days}</Text>
          <Text style={styles.statLabel}>Submitted (30d)</Text>
        </Card>
        <Card style={styles.statCard}>
          <Text style={styles.statValue}>{data.summary.decidedLast30Days}</Text>
          <Text style={styles.statLabel}>Decided (30d)</Text>
        </Card>
      </View>
      <Card style={styles.statCard}>
        <Text style={styles.statValue}>{data.summary.avgDecisionDays ?? '—'}</Text>
        <Text style={styles.statLabel}>Avg Decision Days</Text>
      </Card>

      <Text style={styles.sectionTitle}>By Status</Text>
      <ListCard>
        {data.byStatus.map((s) => (
          <ListRow key={s.status} title={titleCase(s.status)} right={<Text style={styles.count}>{s.count}</Text>} />
        ))}
      </ListCard>

      <Text style={styles.sectionTitle}>By Type</Text>
      <ListCard>
        {data.byType.map((t) => (
          <ListRow key={t.type} title={titleCase(t.type)} right={<Text style={styles.count}>{t.count}</Text>} />
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
