import { StyleSheet, Text } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { ScreenContainer } from '@/components/ScreenContainer';
import { Card } from '@/components/Card';
import { LoadingView } from '@/components/LoadingView';
import { ErrorView } from '@/components/ErrorView';
import { useApi } from '@/hooks/useApi';
import { listEvents } from '@/api/events';
import { colors } from '@/theme';
import { formatDateTime } from '@/utils/format';

// There is no GET-by-id route for events — the list is small enough that
// finding the event client-side from the full list is the pragmatic choice.
export function EventDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data, loading, error, reload } = useApi(listEvents);

  if (loading) return <LoadingView />;
  if (error || !data) return <ErrorView message={error ?? undefined} onRetry={reload} />;

  const event = data.find((e) => e.id === id);
  if (!event) return <ErrorView message="Event not found." />;

  return (
    <ScreenContainer>
      <Card style={styles.card}>
        <Text style={styles.title}>{event.title}</Text>
        <Text style={styles.meta}>{formatDateTime(event.startAt)}{event.endAt ? ` – ${formatDateTime(event.endAt)}` : ''}</Text>
        {event.location && <Text style={styles.meta}>📍 {event.location}</Text>}
        {event.description && <Text style={styles.body}>{event.description}</Text>}
        <Text style={styles.meta}>
          Organized by {event.createdBy.firstName} {event.createdBy.lastName}
        </Text>
      </Card>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  card: { gap: 8 },
  title: { fontSize: 19, fontWeight: '700', color: colors.text },
  meta: { fontSize: 13, color: colors.textMuted },
  body: { fontSize: 15, color: colors.text, lineHeight: 22, marginTop: 4 },
});
