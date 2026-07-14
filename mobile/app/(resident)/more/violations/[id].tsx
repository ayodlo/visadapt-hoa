import { useCallback, useState } from 'react';
import { StyleSheet, Text } from 'react-native';
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
import { getViolation, respondToViolation, appealViolation } from '@/api/violations';
import { ApiError } from '@/api/client';
import { colors } from '@/theme';
import { titleCase, formatDateTime } from '@/utils/format';
import { violationStatusTone } from '@/utils/tones';

const APPEALABLE = ['NOTICE_SENT', 'RESIDENT_RESPONDED', 'UNDER_REVIEW', 'ESCALATED'];

export default function ViolationDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data, loading, error, reload } = useApi(useCallback(() => getViolation(id), [id]));
  const [response, setResponse] = useState('');
  const [appealReason, setAppealReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  async function handleRespond() {
    if (response.trim().length < 10) return;
    setBusy(true);
    setActionError(null);
    try {
      await respondToViolation(id, response.trim());
      setResponse('');
      await reload();
    } catch (e) {
      setActionError(e instanceof ApiError ? e.message : 'Failed to submit response.');
    } finally {
      setBusy(false);
    }
  }

  async function handleAppeal() {
    if (appealReason.trim().length < 20) return;
    setBusy(true);
    setActionError(null);
    try {
      await appealViolation(id, appealReason.trim());
      setAppealReason('');
      await reload();
    } catch (e) {
      setActionError(e instanceof ApiError ? e.message : 'Failed to submit appeal.');
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <LoadingView />;
  if (error || !data) return <ErrorView message={error ?? undefined} onRetry={reload} />;

  const v = data.violation;
  const canRespond = v.status === 'NOTICE_SENT';
  const canAppeal = APPEALABLE.includes(v.status) && !v.appeal;

  return (
    <ScreenContainer>
      <Card style={styles.headerCard}>
        <StatusBadge label={v.status} tone={violationStatusTone(v.status)} />
        <Text style={styles.title}>{titleCase(v.violationType)}</Text>
        {v.ruleCitation && <Text style={styles.meta}>Rule: {v.ruleCitation}</Text>}
        <Text style={styles.description}>{v.description}</Text>
        {v.resolutionSteps && <Text style={styles.meta}>Resolution steps: {v.resolutionSteps}</Text>}
        {v.deadline && <Text style={styles.meta}>Deadline: {formatDateTime(v.deadline)}</Text>}
        <Text style={styles.timestamp}>Observed {formatDateTime(v.observedAt)}</Text>
      </Card>

      {actionError && <Text style={styles.error}>{actionError}</Text>}

      {v.appeal && (
        <Card style={styles.headerCard}>
          <Text style={styles.sectionTitleInline}>Your Appeal</Text>
          <StatusBadge label={v.appeal.status} tone={violationStatusTone(v.status)} />
          <Text style={styles.description}>{v.appeal.reason}</Text>
          {v.appeal.outcome && <Text style={styles.meta}>Outcome: {v.appeal.outcome}</Text>}
        </Card>
      )}

      {canRespond && (
        <Card style={styles.headerCard}>
          <Text style={styles.sectionTitleInline}>Respond to this Notice</Text>
          <FormField
            label="Your response"
            value={response}
            onChangeText={setResponse}
            placeholder="Explain the situation or steps taken (min 10 characters)"
            multiline
            numberOfLines={3}
            style={styles.multiline}
          />
          <Button label="Submit Response" onPress={handleRespond} loading={busy} disabled={response.trim().length < 10} />
        </Card>
      )}

      {canAppeal && (
        <Card style={styles.headerCard}>
          <Text style={styles.sectionTitleInline}>Appeal this Violation</Text>
          <FormField
            label="Reason for appeal"
            value={appealReason}
            onChangeText={setAppealReason}
            placeholder="Explain why you're appealing (min 20 characters)"
            multiline
            numberOfLines={3}
            style={styles.multiline}
          />
          <Button label="Submit Appeal" variant="secondary" onPress={handleAppeal} loading={busy} disabled={appealReason.trim().length < 20} />
        </Card>
      )}

      <Text style={styles.sectionTitle}>Comments</Text>
      {v.comments.length === 0 ? (
        <Card>
          <EmptyState icon="💬" message="No comments yet" />
        </Card>
      ) : (
        v.comments.map((c) => (
          <Card key={c.id} style={styles.commentCard}>
            {c.author && (
              <Text style={styles.commentAuthor}>
                {c.author.firstName} {c.author.lastName}
                <Text style={styles.commentRole}> · {titleCase(c.author.role)}</Text>
              </Text>
            )}
            <Text style={styles.commentBody}>{c.body}</Text>
            <Text style={styles.timestamp}>{formatDateTime(c.createdAt)}</Text>
          </Card>
        ))
      )}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  headerCard: { gap: 8 },
  title: { fontSize: 18, fontWeight: '700', color: colors.text },
  description: { fontSize: 14, color: colors.text },
  meta: { fontSize: 13, color: colors.textMuted },
  timestamp: { fontSize: 12, color: colors.textFaint },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: colors.text, marginTop: 4 },
  sectionTitleInline: { fontSize: 15, fontWeight: '700', color: colors.text },
  commentCard: { gap: 4 },
  commentAuthor: { fontSize: 13, fontWeight: '600', color: colors.text },
  commentRole: { fontWeight: '400', color: colors.textMuted },
  commentBody: { fontSize: 14, color: colors.text },
  multiline: { minHeight: 70, textAlignVertical: 'top' },
  error: { color: colors.danger, fontSize: 13 },
});
