import { StyleSheet, Text, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { useCallback } from 'react';
import { ScreenContainer } from '@/components/ScreenContainer';
import { Card } from '@/components/Card';
import { ListCard } from '@/components/ListCard';
import { ListRow } from '@/components/ListRow';
import { LoadingView } from '@/components/LoadingView';
import { ErrorView } from '@/components/ErrorView';
import { EmptyState } from '@/components/EmptyState';
import { StatusBadge } from '@/components/StatusBadge';
import { Button } from '@/components/Button';
import { useApi } from '@/hooks/useApi';
import { getLedger } from '@/api/payments';
import { colors } from '@/theme';
import { formatCents, formatDate } from '@/utils/format';
import { chargeStatusTone, paymentStatusTone } from '@/utils/tones';

export default function PaymentsScreen() {
  const { data, loading, error, refreshing, refresh } = useApi(getLedger);

  useFocusEffect(
    useCallback(() => {
      refresh();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])
  );

  if (loading) return <LoadingView />;
  if (error || !data) return <ErrorView message={error ?? undefined} onRetry={refresh} />;

  const { charges, payments, summary } = data;
  const pendingCharges = charges.filter((c) => c.status === 'PENDING' || c.status === 'OVERDUE');

  return (
    <ScreenContainer onRefresh={refresh} refreshing={refreshing}>
      <View style={styles.statRow}>
        <Card style={styles.statCard}>
          <Text style={styles.statLabel}>Balance Due</Text>
          <Text style={[styles.statValue, summary.totalBalance > 0 && styles.danger]}>
            {formatCents(summary.totalBalance)}
          </Text>
        </Card>
        <Card style={styles.statCard}>
          <Text style={styles.statLabel}>Overdue</Text>
          <Text style={[styles.statValue, summary.overdueAmount > 0 && styles.warning]}>
            {formatCents(summary.overdueAmount)}
          </Text>
        </Card>
      </View>
      <View style={styles.statRow}>
        <Card style={styles.statCard}>
          <Text style={styles.statLabel}>Paid This Year</Text>
          <Text style={styles.statValue}>{formatCents(summary.paidThisYear)}</Text>
        </Card>
        <Card style={styles.statCard}>
          <Text style={styles.statLabel}>Next Due</Text>
          <Text style={styles.statValueSm}>{summary.nextDueDate ? formatDate(summary.nextDueDate) : 'None'}</Text>
        </Card>
      </View>

      {summary.totalBalance > 0 && (
        <Button label="Make a Payment" onPress={() => router.push('/payments/pay')} />
      )}

      <Text style={styles.sectionTitle}>Outstanding Charges</Text>
      {pendingCharges.length === 0 ? (
        <Card>
          <EmptyState icon="✅" message="You have no outstanding charges" />
        </Card>
      ) : (
        <ListCard>
          {pendingCharges.map((c) => (
            <ListRow
              key={c.id}
              title={c.description}
              subtitle={`Due ${formatDate(c.dueDate)}`}
              right={
                <View style={styles.rightCol}>
                  <StatusBadge label={c.status} tone={chargeStatusTone(c.status)} />
                  <Text style={styles.amount}>{formatCents(c.amount)}</Text>
                </View>
              }
            />
          ))}
        </ListCard>
      )}

      <Text style={styles.sectionTitle}>Payment History</Text>
      {payments.length === 0 ? (
        <Card>
          <EmptyState icon="🧾" message="No payments yet" />
        </Card>
      ) : (
        <ListCard>
          {payments.map((p) => (
            <ListRow
              key={p.id}
              title={p.paymentMethod}
              subtitle={p.paidAt ? formatDate(p.paidAt) : p.confirmationNumber}
              right={
                <View style={styles.rightCol}>
                  <StatusBadge label={p.status} tone={paymentStatusTone(p.status)} />
                  <Text style={styles.amount}>{formatCents(p.amount)}</Text>
                </View>
              }
            />
          ))}
        </ListCard>
      )}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  statRow: { flexDirection: 'row', gap: 12 },
  statCard: { flex: 1, gap: 4 },
  statLabel: { fontSize: 12, color: colors.textMuted, textTransform: 'uppercase' },
  statValue: { fontSize: 20, fontWeight: '700', color: colors.text },
  statValueSm: { fontSize: 15, fontWeight: '700', color: colors.text },
  danger: { color: colors.danger },
  warning: { color: colors.warning },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: colors.text, marginTop: 8 },
  rightCol: { alignItems: 'flex-end', gap: 4 },
  amount: { fontSize: 13, fontWeight: '600', color: colors.text },
});
