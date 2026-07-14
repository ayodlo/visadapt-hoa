import { StyleSheet, Text, View } from 'react-native';
import { ScreenContainer } from '@/components/ScreenContainer';
import { Card } from '@/components/Card';
import { ListCard } from '@/components/ListCard';
import { ListRow } from '@/components/ListRow';
import { LoadingView } from '@/components/LoadingView';
import { ErrorView } from '@/components/ErrorView';
import { EmptyState } from '@/components/EmptyState';
import { useApi } from '@/hooks/useApi';
import { getPaymentsReport } from '@/api/admin';
import { colors } from '@/theme';
import { formatCents, formatDate, titleCase } from '@/utils/format';

export default function PaymentsReportScreen() {
  const { data, loading, error, refresh } = useApi(getPaymentsReport);

  if (loading) return <LoadingView />;
  if (error || !data) return <ErrorView message={error ?? undefined} onRetry={refresh} />;

  const { summary } = data;

  return (
    <ScreenContainer>
      <View style={styles.statRow}>
        <Card style={styles.statCard}>
          <Text style={styles.statValue}>{formatCents(summary.totalBilledCents)}</Text>
          <Text style={styles.statLabel}>Total Billed</Text>
        </Card>
        <Card style={styles.statCard}>
          <Text style={styles.statValue}>{formatCents(summary.totalCollectedCents)}</Text>
          <Text style={styles.statLabel}>Total Collected</Text>
        </Card>
      </View>
      <View style={styles.statRow}>
        <Card style={styles.statCard}>
          <Text style={[styles.statValue, styles.danger]}>{formatCents(summary.outstandingCents)}</Text>
          <Text style={styles.statLabel}>Outstanding</Text>
        </Card>
        <Card style={styles.statCard}>
          <Text style={styles.statValue}>{summary.delinquentAccounts}</Text>
          <Text style={styles.statLabel}>Delinquent Accounts</Text>
        </Card>
      </View>
      <View style={styles.statRow}>
        <Card style={styles.statCard}>
          <Text style={styles.statValue}>{summary.totalCharges}</Text>
          <Text style={styles.statLabel}>Total Charges</Text>
        </Card>
        <Card style={styles.statCard}>
          <Text style={styles.statValue}>{summary.totalPayments}</Text>
          <Text style={styles.statLabel}>Payments Made</Text>
        </Card>
      </View>

      <Text style={styles.sectionTitle}>By Status</Text>
      <ListCard>
        {data.byStatus.map((s) => (
          <ListRow key={s.status} title={titleCase(s.status)} right={<Text style={styles.count}>{formatCents(s.amountCents)} ({s.count})</Text>} />
        ))}
      </ListCard>

      <Text style={styles.sectionTitle}>Recent Payments</Text>
      {data.recentPayments.length === 0 ? (
        <Card>
          <EmptyState icon="🧾" message="No payments yet" />
        </Card>
      ) : (
        <ListCard>
          {data.recentPayments.map((p) => (
            <ListRow
              key={p.id}
              title={p.residentName}
              subtitle={`${p.paymentMethod} · ${p.paidAt ? formatDate(p.paidAt) : formatDate(p.createdAt)}`}
              right={<Text style={styles.count}>{formatCents(p.amount)}</Text>}
            />
          ))}
        </ListCard>
      )}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  statRow: { flexDirection: 'row', gap: 12 },
  statCard: { flex: 1, alignItems: 'center', gap: 4 },
  statValue: { fontSize: 18, fontWeight: '700', color: colors.text },
  statLabel: { fontSize: 12, color: colors.textMuted, textAlign: 'center' },
  danger: { color: colors.danger },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: colors.text, marginTop: 8 },
  count: { fontSize: 13, fontWeight: '600', color: colors.text },
});
