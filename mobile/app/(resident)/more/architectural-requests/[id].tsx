import { useCallback, useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { ScreenContainer } from '@/components/ScreenContainer';
import { Card } from '@/components/Card';
import { StatusBadge } from '@/components/StatusBadge';
import { LoadingView } from '@/components/LoadingView';
import { ErrorView } from '@/components/ErrorView';
import { EmptyState } from '@/components/EmptyState';
import { FormField } from '@/components/FormField';
import { Button } from '@/components/Button';
import { useApi } from '@/hooks/useApi';
import { getArchRequest, addArchRequestComment, withdrawArchRequest, submitArchRequest } from '@/api/architecturalRequests';
import { ApiError } from '@/api/client';
import { colors } from '@/theme';
import { titleCase, formatDateTime } from '@/utils/format';
import { archStatusTone } from '@/utils/tones';

const COMMENTABLE = ['DRAFT', 'SUBMITTED', 'UNDER_REVIEW', 'NEEDS_MORE_INFORMATION'];
const WITHDRAWABLE = ['DRAFT', 'SUBMITTED', 'UNDER_REVIEW', 'NEEDS_MORE_INFORMATION'];

export default function ArchRequestDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data, loading, error, reload } = useApi(useCallback(() => getArchRequest(id), [id]));
  const [comment, setComment] = useState('');
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  async function handleAddComment() {
    if (!comment.trim()) return;
    setBusy(true);
    setActionError(null);
    try {
      await addArchRequestComment(id, comment.trim());
      setComment('');
      await reload();
    } catch (e) {
      setActionError(e instanceof ApiError ? e.message : 'Failed to post comment.');
    } finally {
      setBusy(false);
    }
  }

  async function handleWithdraw() {
    Alert.alert('Withdraw request', 'This cannot be undone. Continue?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Withdraw',
        style: 'destructive',
        onPress: async () => {
          setBusy(true);
          try {
            await withdrawArchRequest(id);
            await reload();
          } catch (e) {
            setActionError(e instanceof ApiError ? e.message : 'Failed to withdraw.');
          } finally {
            setBusy(false);
          }
        },
      },
    ]);
  }

  async function handleSubmit() {
    setBusy(true);
    setActionError(null);
    try {
      await submitArchRequest(id);
      await reload();
    } catch (e) {
      setActionError(e instanceof ApiError ? e.message : 'Failed to submit.');
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <LoadingView />;
  if (error || !data) return <ErrorView message={error ?? undefined} onRetry={reload} />;

  const request = data.request;
  const canComment = COMMENTABLE.includes(request.status);
  const canWithdraw = WITHDRAWABLE.includes(request.status);

  return (
    <ScreenContainer>
      <Card style={styles.headerCard}>
        <StatusBadge label={request.status} tone={archStatusTone(request.status)} />
        <Text style={styles.title}>{titleCase(request.requestType)}</Text>
        <Text style={styles.description}>{request.description}</Text>
        {request.property && (
          <Text style={styles.meta}>
            {request.property.streetAddress}
            {request.property.unitNumber ? `, Unit ${request.property.unitNumber}` : ''}
          </Text>
        )}
        {request.decisionReason && (
          <Text style={styles.decision}>Decision: {request.decisionReason}</Text>
        )}
        <Text style={styles.timestamp}>Submitted {formatDateTime(request.createdAt)}</Text>
      </Card>

      {actionError && <Text style={styles.error}>{actionError}</Text>}

      <View style={styles.actionRow}>
        {request.status === 'DRAFT' && (
          <Button label="Submit for Review" onPress={handleSubmit} loading={busy} />
        )}
        {canWithdraw && (
          <Button label="Withdraw" variant="danger" onPress={handleWithdraw} loading={busy} />
        )}
      </View>

      <Text style={styles.sectionTitle}>Comments</Text>
      {request.comments.length === 0 ? (
        <Card>
          <EmptyState icon="💬" message="No comments yet" />
        </Card>
      ) : (
        request.comments.map((c) => (
          <Card key={c.id} style={styles.commentCard}>
            <Text style={styles.commentAuthor}>
              {c.author.firstName} {c.author.lastName}
              <Text style={styles.commentRole}> · {titleCase(c.author.role)}</Text>
            </Text>
            <Text style={styles.commentBody}>{c.body}</Text>
            <Text style={styles.timestamp}>{formatDateTime(c.createdAt)}</Text>
          </Card>
        ))
      )}

      {canComment && (
        <>
          <FormField
            label="Add a comment"
            value={comment}
            onChangeText={setComment}
            placeholder="Write a comment..."
            multiline
            numberOfLines={3}
            style={styles.multiline}
          />
          <Button label="Post Comment" onPress={handleAddComment} loading={busy} disabled={!comment.trim()} />
        </>
      )}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  headerCard: { gap: 8 },
  title: { fontSize: 18, fontWeight: '700', color: colors.text },
  description: { fontSize: 14, color: colors.text },
  meta: { fontSize: 13, color: colors.textMuted },
  decision: { fontSize: 13, color: colors.text, fontStyle: 'italic' },
  timestamp: { fontSize: 12, color: colors.textFaint },
  actionRow: { flexDirection: 'row', gap: 8 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: colors.text, marginTop: 4 },
  commentCard: { gap: 4 },
  commentAuthor: { fontSize: 13, fontWeight: '600', color: colors.text },
  commentRole: { fontWeight: '400', color: colors.textMuted },
  commentBody: { fontSize: 14, color: colors.text },
  multiline: { minHeight: 70, textAlignVertical: 'top' },
  error: { color: colors.danger, fontSize: 13 },
});
