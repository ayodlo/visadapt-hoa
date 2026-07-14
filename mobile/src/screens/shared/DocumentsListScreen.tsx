import { useCallback, useState } from 'react';
import { ActivityIndicator } from 'react-native';
import { router } from 'expo-router';
import { ScreenContainer } from '@/components/ScreenContainer';
import { FormField } from '@/components/FormField';
import { ListCard } from '@/components/ListCard';
import { ListRow } from '@/components/ListRow';
import { ErrorView } from '@/components/ErrorView';
import { EmptyState } from '@/components/EmptyState';
import { useApi } from '@/hooks/useApi';
import { listDocuments } from '@/api/documents';
import { colors } from '@/theme';
import { titleCase, formatDate } from '@/utils/format';

export function DocumentsListScreen() {
  const [search, setSearch] = useState('');
  const { data, loading, error, refreshing, refresh } = useApi(
    useCallback(() => listDocuments(search || undefined), [search])
  );

  return (
    <ScreenContainer onRefresh={refresh} refreshing={refreshing}>
      <FormField label="Search" value={search} onChangeText={setSearch} placeholder="Search documents..." />

      {loading ? (
        <ActivityIndicator color={colors.primary} style={{ marginTop: 24 }} />
      ) : error || !data ? (
        <ErrorView message={error ?? undefined} onRetry={refresh} />
      ) : data.documents.length === 0 ? (
        <EmptyState icon="📄" message="No documents found" />
      ) : (
        <ListCard>
          {data.documents.map((d) => (
            <ListRow
              key={d.id}
              title={d.title}
              subtitle={`${titleCase(d.category)} · ${formatDate(d.createdAt)}`}
              onPress={() => router.push(`/more/documents/${d.id}`)}
            />
          ))}
        </ListCard>
      )}
    </ScreenContainer>
  );
}
