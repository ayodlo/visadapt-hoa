import { useCallback, useState } from 'react';
import { Linking, StyleSheet, Text } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { ScreenContainer } from '@/components/ScreenContainer';
import { Card } from '@/components/Card';
import { LoadingView } from '@/components/LoadingView';
import { ErrorView } from '@/components/ErrorView';
import { Button } from '@/components/Button';
import { useApi } from '@/hooks/useApi';
import { getDocument, getDocumentDownloadUrl } from '@/api/documents';
import { ApiError } from '@/api/client';
import { colors } from '@/theme';
import { titleCase, formatDate } from '@/utils/format';

export function DocumentDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data, loading, error, reload } = useApi(useCallback(() => getDocument(id), [id]));
  const [opening, setOpening] = useState(false);
  const [openError, setOpenError] = useState<string | null>(null);

  async function handleOpen() {
    setOpening(true);
    setOpenError(null);
    try {
      const { url } = await getDocumentDownloadUrl(id);
      await Linking.openURL(url);
    } catch (e) {
      setOpenError(e instanceof ApiError ? e.message : 'Could not open this document.');
    } finally {
      setOpening(false);
    }
  }

  if (loading) return <LoadingView />;
  if (error || !data) return <ErrorView message={error ?? undefined} onRetry={reload} />;

  return (
    <ScreenContainer>
      <Card style={styles.card}>
        <Text style={styles.title}>{data.title}</Text>
        <Text style={styles.meta}>{titleCase(data.category)} · {formatDate(data.createdAt)}</Text>
        {data.description && <Text style={styles.description}>{data.description}</Text>}
        <Text style={styles.meta}>
          Uploaded by {data.uploadedBy.firstName} {data.uploadedBy.lastName}
        </Text>
      </Card>
      {openError && <Text style={styles.error}>{openError}</Text>}
      <Button label="Open Document" onPress={handleOpen} loading={opening} />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  card: { gap: 8 },
  title: { fontSize: 18, fontWeight: '700', color: colors.text },
  meta: { fontSize: 13, color: colors.textMuted },
  description: { fontSize: 14, color: colors.text, marginTop: 4 },
  error: { color: colors.danger, fontSize: 13 },
});
