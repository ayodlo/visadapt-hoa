import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { ScreenContainer } from '@/components/ScreenContainer';
import { Card } from '@/components/Card';
import { FormField } from '@/components/FormField';
import { ChipSelect } from '@/components/ChipSelect';
import { Button } from '@/components/Button';
import { LoadingView } from '@/components/LoadingView';
import { getLedger, payBalance } from '@/api/payments';
import { ApiError } from '@/api/client';
import { useApi } from '@/hooks/useApi';
import { colors } from '@/theme';
import { formatCents, formatDateTime } from '@/utils/format';
import type { PaymentMethod, PayReceipt } from '@/types/payments';

const METHODS: { value: PaymentMethod; label: string }[] = [
  { value: 'Credit Card', label: 'Credit Card' },
  { value: 'Debit Card', label: 'Debit Card' },
  { value: 'Bank Transfer', label: 'Bank Transfer' },
  { value: 'Check', label: 'Check' },
];

export default function PayScreen() {
  const { data, loading } = useApi(getLedger);
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState<PaymentMethod>('Credit Card');
  const [step, setStep] = useState<'form' | 'processing' | 'receipt'>('form');
  const [receipt, setReceipt] = useState<PayReceipt['receipt'] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const balance = data?.summary.totalBalance ?? 0;
  // `amount` starts empty (not yet touched by the user); render the
  // outstanding balance as the default rather than syncing it into state.
  const displayAmount = amount !== '' ? amount : balance > 0 ? (balance / 100).toFixed(2) : '';

  if (loading || !data) return <LoadingView />;

  async function handlePay() {
    const cents = Math.round(parseFloat(displayAmount) * 100);
    if (isNaN(cents) || cents <= 0) {
      setError('Enter a valid payment amount.');
      return;
    }
    if (cents > balance) {
      setError(`Amount cannot exceed your balance of ${formatCents(balance)}.`);
      return;
    }
    setError(null);
    setStep('processing');
    try {
      const res = await payBalance(cents, method);
      setReceipt(res.receipt);
      setStep('receipt');
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Payment failed.');
      setStep('form');
    }
  }

  if (step === 'processing') {
    return <LoadingView />;
  }

  if (step === 'receipt' && receipt) {
    return (
      <ScreenContainer>
        <Card style={styles.receiptCard}>
          <Text style={styles.receiptIcon}>✅</Text>
          <Text style={styles.receiptTitle}>Payment Successful</Text>
          <View style={styles.receiptRow}>
            <Text style={styles.receiptLabel}>Confirmation</Text>
            <Text style={styles.receiptValueMono}>{receipt.confirmationNumber}</Text>
          </View>
          <View style={styles.receiptRow}>
            <Text style={styles.receiptLabel}>Amount</Text>
            <Text style={styles.receiptValue}>{formatCents(receipt.amount)}</Text>
          </View>
          <View style={styles.receiptRow}>
            <Text style={styles.receiptLabel}>Method</Text>
            <Text style={styles.receiptValue}>{receipt.paymentMethod}</Text>
          </View>
          <View style={styles.receiptRow}>
            <Text style={styles.receiptLabel}>Date</Text>
            <Text style={styles.receiptValue}>{formatDateTime(receipt.paidAt)}</Text>
          </View>
        </Card>
        <Button label="Done" onPress={() => router.replace('/payments')} />
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer>
      <Text style={styles.balanceLine}>
        Balance due: <Text style={styles.balanceAmount}>{formatCents(balance)}</Text>
      </Text>
      <FormField
        label="Amount ($)"
        keyboardType="decimal-pad"
        value={displayAmount}
        onChangeText={setAmount}
        placeholder="0.00"
      />
      <Text style={styles.fieldLabel}>Payment Method</Text>
      <ChipSelect options={METHODS} value={method} onChange={setMethod} />
      {error && <Text style={styles.error}>{error}</Text>}
      <Button label="Pay Now" onPress={handlePay} />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  balanceLine: { fontSize: 14, color: colors.textMuted },
  balanceAmount: { fontWeight: '700', color: colors.text },
  fieldLabel: { fontSize: 13, fontWeight: '600', color: colors.textMuted },
  error: { color: colors.danger, fontSize: 13 },
  receiptCard: { alignItems: 'center', gap: 10 },
  receiptIcon: { fontSize: 32 },
  receiptTitle: { fontSize: 18, fontWeight: '700', color: colors.text, marginBottom: 6 },
  receiptRow: { flexDirection: 'row', justifyContent: 'space-between', width: '100%' },
  receiptLabel: { color: colors.textMuted, fontSize: 14 },
  receiptValue: { color: colors.text, fontSize: 14, fontWeight: '600' },
  receiptValueMono: { color: colors.text, fontSize: 14, fontWeight: '700', fontFamily: 'monospace' },
});
