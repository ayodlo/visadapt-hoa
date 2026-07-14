import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text } from 'react-native';
import { router, Stack } from 'expo-router';
import { ScreenContainer } from '@/components/ScreenContainer';
import { FormField } from '@/components/FormField';
import { ChipSelect } from '@/components/ChipSelect';
import { ListCard } from '@/components/ListCard';
import { ListRow } from '@/components/ListRow';
import { ErrorView } from '@/components/ErrorView';
import { EmptyState } from '@/components/EmptyState';
import { StatusBadge } from '@/components/StatusBadge';
import { useApi } from '@/hooks/useApi';
import { listAdminViolations } from '@/api/board';
import { colors } from '@/theme';
import { titleCase, formatDate } from '@/utils/format';
import { violationStatusTone } from '@/utils/tones';

const STATUS_FILTERS: { value: string; label: string }[] = [
  { value: '', label: 'All' },
  { value: 'NOTICE_SENT', label: 'Notice Sent' },
  { value: 'RESIDENT_RESPONDED', label: 'Responded' },
  { value: 'ESCALATED', label: 'Escalated' },
  { value: 'RESOLVED', label: 'Resolved' },
];

export default function AdminViolationsList() {
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');

  const { data, loading, error, refreshing, refresh } = useApi(
    useCallback(() => listAdminViolations({ search: search || undefined, status: status || undefined }), [search, status])
  );

  return (
    <>
      <Stack.Screen
        options={{
          headerRight: () => (
            <Pressable onPress={() => router.push('/violations/new')} hitSlop={12}>
              <Text style={styles.addButton}>+ New</Text>
            </Pressable>
          ),
        }}
      />
      <ScreenContainer onRefresh={refresh} refreshing={refreshing}>
        <FormField label="Search" value={search} onChangeText={setSearch} placeholder="Search violations..." />
        <ChipSelect options={STATUS_FILTERS} value={status} onChange={setStatus} />

        {loading ? (
          <ActivityIndicator color={colors.primary} style={{ marginTop: 24 }} />
        ) : error || !data ? (
          <ErrorView message={error ?? undefined} onRetry={refresh} />
        ) : data.violations.length === 0 ? (
          <EmptyState icon="⚠️" message="No violations found" />
        ) : (
          <ListCard>
            {data.violations.map((v) => (
              <ListRow
                key={v.id}
                title={`${titleCase(v.violationType)} — ${v.resident.firstName} ${v.resident.lastName}`}
                subtitle={formatDate(v.observedAt)}
                right={<StatusBadge label={v.status} tone={violationStatusTone(v.status)} />}
                onPress={() => router.push(`/violations/${v.id}`)}
              />
            ))}
          </ListCard>
        )}
      </ScreenContainer>
    </>
  );
}

const styles = StyleSheet.create({
  addButton: { color: colors.primary, fontSize: 15, fontWeight: '600' },
});
