import { useCallback, useState } from 'react';
import { ActivityIndicator } from 'react-native';
import { router } from 'expo-router';
import { ScreenContainer } from '@/components/ScreenContainer';
import { FormField } from '@/components/FormField';
import { ChipSelect } from '@/components/ChipSelect';
import { ListCard } from '@/components/ListCard';
import { ListRow } from '@/components/ListRow';
import { ErrorView } from '@/components/ErrorView';
import { EmptyState } from '@/components/EmptyState';
import { StatusBadge } from '@/components/StatusBadge';
import { useApi } from '@/hooks/useApi';
import { listAdminIssues } from '@/api/admin';
import { colors } from '@/theme';
import { formatDate } from '@/utils/format';
import { issueStatusTone } from '@/utils/tones';

const STATUS_FILTERS: { value: string; label: string }[] = [
  { value: '', label: 'All' },
  { value: 'SUBMITTED', label: 'Submitted' },
  { value: 'UNDER_REVIEW', label: 'Under Review' },
  { value: 'ASSIGNED', label: 'Assigned' },
  { value: 'IN_PROGRESS', label: 'In Progress' },
  { value: 'RESOLVED', label: 'Resolved' },
];

export default function AdminIssuesList() {
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');

  const { data, loading, error, refreshing, refresh } = useApi(
    useCallback(() => listAdminIssues({ search: search || undefined, status: status || undefined }), [search, status])
  );

  return (
    <ScreenContainer onRefresh={refresh} refreshing={refreshing}>
      <FormField label="Search" value={search} onChangeText={setSearch} placeholder="Search issues..." />
      <ChipSelect options={STATUS_FILTERS} value={status} onChange={setStatus} />

      {loading ? (
        <ActivityIndicator color={colors.primary} style={{ marginTop: 24 }} />
      ) : error || !data ? (
        <ErrorView message={error ?? undefined} onRetry={refresh} />
      ) : data.issues.length === 0 ? (
        <EmptyState icon="🔨" message="No issues found" />
      ) : (
        <ListCard>
          {data.issues.map((issue) => (
            <ListRow
              key={issue.id}
              title={issue.title}
              subtitle={`${issue.resident.firstName} ${issue.resident.lastName} · ${formatDate(issue.createdAt)}`}
              right={<StatusBadge label={issue.status} tone={issueStatusTone(issue.status)} />}
              onPress={() => router.push(`/issues/${issue.id}`)}
            />
          ))}
        </ListCard>
      )}
    </ScreenContainer>
  );
}
