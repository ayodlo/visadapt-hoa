import { useCallback, useEffect } from 'react';
import { StyleSheet, Text } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { ScreenContainer } from '@/components/ScreenContainer';
import { Card } from '@/components/Card';
import { StatusBadge } from '@/components/StatusBadge';
import { LoadingView } from '@/components/LoadingView';
import { ErrorView } from '@/components/ErrorView';
import { useApi } from '@/hooks/useApi';
import { getAnnouncement, markAnnouncementRead } from '@/api/announcements';
import { colors } from '@/theme';
import { formatDateTime } from '@/utils/format';
import { announcementPriorityTone } from '@/utils/tones';

export function AnnouncementDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data, loading, error, reload } = useApi(useCallback(() => getAnnouncement(id), [id]));

  useEffect(() => {
    markAnnouncementRead(id).catch(() => {});
  }, [id]);

  if (loading) return <LoadingView />;
  if (error || !data) return <ErrorView message={error ?? undefined} onRetry={reload} />;

  const a = data.announcement;

  return (
    <ScreenContainer>
      <Card style={styles.card}>
        {a.priority !== 'NORMAL' && <StatusBadge label={a.priority} tone={announcementPriorityTone(a.priority)} />}
        <Text style={styles.title}>{a.title}</Text>
        <Text style={styles.meta}>
          {a.createdBy.firstName} {a.createdBy.lastName} · {formatDateTime(a.publishAt)}
        </Text>
        <Text style={styles.body}>{a.body}</Text>
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
