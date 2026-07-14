import { useCallback, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
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
import { getIssue, addIssueComment } from '@/api/issues';
import { ApiError } from '@/api/client';
import { colors } from '@/theme';
import { titleCase, formatDateTime } from '@/utils/format';
import { issueStatusTone, issuePriorityTone } from '@/utils/tones';

export default function IssueDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data, loading, error, reload } = useApi(useCallback(() => getIssue(id), [id]));
  const [comment, setComment] = useState('');
  const [posting, setPosting] = useState(false);
  const [postError, setPostError] = useState<string | null>(null);

  async function handleAddComment() {
    if (!comment.trim()) return;
    setPosting(true);
    setPostError(null);
    try {
      await addIssueComment(id, comment.trim());
      setComment('');
      await reload();
    } catch (e) {
      setPostError(e instanceof ApiError ? e.message : 'Failed to post comment.');
    } finally {
      setPosting(false);
    }
  }

  if (loading) return <LoadingView />;
  if (error || !data) return <ErrorView message={error ?? undefined} onRetry={reload} />;

  const issue = data.issue;

  return (
    <ScreenContainer>
      <Card style={styles.headerCard}>
        <View style={styles.badgeRow}>
          <StatusBadge label={issue.status} tone={issueStatusTone(issue.status)} />
          <StatusBadge label={issue.priority} tone={issuePriorityTone(issue.priority)} />
        </View>
        <Text style={styles.title}>{issue.title}</Text>
        <Text style={styles.meta}>{titleCase(issue.category)} · {issue.location}</Text>
        <Text style={styles.description}>{issue.description}</Text>

        {issue.assignedTo && (
          <Text style={styles.meta}>Assigned to {issue.assignedTo.firstName} {issue.assignedTo.lastName}</Text>
        )}
        {issue.vendor && <Text style={styles.meta}>Vendor: {issue.vendor.name}</Text>}
        <Text style={styles.timestamp}>Reported {formatDateTime(issue.createdAt)}</Text>
      </Card>

      <Text style={styles.sectionTitle}>Comments</Text>
      {issue.comments.length === 0 ? (
        <Card>
          <EmptyState icon="💬" message="No comments yet" />
        </Card>
      ) : (
        issue.comments.map((c) => (
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

      <FormField
        label="Add a comment"
        value={comment}
        onChangeText={setComment}
        placeholder="Write a comment..."
        multiline
        numberOfLines={3}
        style={styles.multiline}
      />
      {postError && <Text style={styles.error}>{postError}</Text>}
      <Button label="Post Comment" onPress={handleAddComment} loading={posting} disabled={!comment.trim()} />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  headerCard: { gap: 8 },
  badgeRow: { flexDirection: 'row', gap: 8 },
  title: { fontSize: 18, fontWeight: '700', color: colors.text },
  meta: { fontSize: 13, color: colors.textMuted },
  description: { fontSize: 14, color: colors.text, marginTop: 4 },
  timestamp: { fontSize: 12, color: colors.textFaint },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: colors.text, marginTop: 4 },
  commentCard: { gap: 4 },
  commentAuthor: { fontSize: 13, fontWeight: '600', color: colors.text },
  commentRole: { fontWeight: '400', color: colors.textMuted },
  commentBody: { fontSize: 14, color: colors.text },
  multiline: { minHeight: 70, textAlignVertical: 'top' },
  error: { color: colors.danger, fontSize: 13 },
});
