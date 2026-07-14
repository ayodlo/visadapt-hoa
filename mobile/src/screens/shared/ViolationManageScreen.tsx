import { useCallback, useState } from 'react';
import { StyleSheet, Switch, Text, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { ScreenContainer } from '@/components/ScreenContainer';
import { Card } from '@/components/Card';
import { StatusBadge } from '@/components/StatusBadge';
import { LoadingView } from '@/components/LoadingView';
import { ErrorView } from '@/components/ErrorView';
import { EmptyState } from '@/components/EmptyState';
import { FormField } from '@/components/FormField';
import { ChipSelect } from '@/components/ChipSelect';
import { Button } from '@/components/Button';
import { useApi } from '@/hooks/useApi';
import { getAdminViolation, updateAdminViolation, decideAppeal } from '@/api/board';
import { ApiError } from '@/api/client';
import { colors } from '@/theme';
import { titleCase, formatDateTime } from '@/utils/format';
import { violationStatusTone } from '@/utils/tones';
import type { ViolationStatusUpdateInput, AppealDecisionInput } from '@/types/board';

const APPEAL_CHOICES: { value: AppealDecisionInput['status']; label: string }[] = [
  { value: 'UNDER_REVIEW', label: 'Under Review' },
  { value: 'APPROVED', label: 'Approve' },
  { value: 'DENIED', label: 'Deny' },
  { value: 'WITHDRAWN', label: 'Withdrawn' },
];

// Shared between (board) and (admin) — same underlying admin/violations API
// for both roles; the only role-specific difference is which status
// transitions are offered (admin manages the full lifecycle, board mainly
// reviews escalations/appeals), so the caller supplies that list.
export function ViolationManageScreen({
  statusChoices,
}: {
  statusChoices: { value: NonNullable<ViolationStatusUpdateInput['status']> | ''; label: string }[];
}) {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data, loading, error, reload } = useApi(useCallback(() => getAdminViolation(id), [id]));

  const [statusChoice, setStatusChoice] = useState<NonNullable<ViolationStatusUpdateInput['status']> | ''>('');
  const [resolutionSteps, setResolutionSteps] = useState('');
  const [comment, setComment] = useState('');
  const [isInternal, setIsInternal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  const [appealStatus, setAppealStatus] = useState<AppealDecisionInput['status']>('UNDER_REVIEW');
  const [appealOutcome, setAppealOutcome] = useState('');
  const [appealSaving, setAppealSaving] = useState(false);
  const [appealError, setAppealError] = useState<string | null>(null);

  async function handleSaveStatus() {
    setSaving(true);
    setSaveError(null);
    setSaveMessage(null);
    try {
      const input: ViolationStatusUpdateInput = {};
      if (statusChoice) input.status = statusChoice;
      if (resolutionSteps.trim()) input.resolutionSteps = resolutionSteps.trim();
      if (comment.trim()) {
        input.comment = comment.trim();
        input.isInternal = isInternal;
      }
      await updateAdminViolation(id, input);
      setStatusChoice('');
      setResolutionSteps('');
      setComment('');
      setIsInternal(false);
      setSaveMessage('Saved.');
      await reload();
    } catch (e) {
      setSaveError(e instanceof ApiError ? e.message : 'Failed to save.');
    } finally {
      setSaving(false);
    }
  }

  async function handleAppealDecision() {
    setAppealSaving(true);
    setAppealError(null);
    try {
      await decideAppeal(id, { status: appealStatus, outcome: appealOutcome.trim() || undefined });
      setAppealOutcome('');
      await reload();
    } catch (e) {
      setAppealError(e instanceof ApiError ? e.message : 'Failed to save appeal decision.');
    } finally {
      setAppealSaving(false);
    }
  }

  if (loading) return <LoadingView />;
  if (error || !data) return <ErrorView message={error ?? undefined} onRetry={reload} />;

  const v = data.violation;
  const hasStatusChanges = !!(statusChoice || resolutionSteps.trim() || comment.trim());

  return (
    <ScreenContainer>
      <Card style={styles.headerCard}>
        <StatusBadge label={v.status} tone={violationStatusTone(v.status)} />
        <Text style={styles.title}>{titleCase(v.violationType)}</Text>
        <Text style={styles.meta}>
          {v.resident.firstName} {v.resident.lastName} · {v.resident.email}
        </Text>
        {v.property && (
          <Text style={styles.meta}>
            {v.property.streetAddress}
            {v.property.unitNumber ? `, Unit ${v.property.unitNumber}` : ''}
          </Text>
        )}
        <Text style={styles.description}>{v.description}</Text>
        {v.ruleCitation && <Text style={styles.meta}>Rule: {v.ruleCitation}</Text>}
        {v.resolutionSteps && <Text style={styles.meta}>Resolution steps: {v.resolutionSteps}</Text>}
        <Text style={styles.timestamp}>Observed {formatDateTime(v.observedAt)}</Text>
      </Card>

      {v.appeal && (
        <Card style={styles.headerCard}>
          <Text style={styles.sectionTitleInline}>Appeal</Text>
          <StatusBadge label={v.appeal.status} tone={violationStatusTone(v.status)} />
          <Text style={styles.description}>{v.appeal.reason}</Text>
          {v.appeal.outcome && <Text style={styles.meta}>Outcome: {v.appeal.outcome}</Text>}

          <Text style={styles.fieldLabel}>Decision</Text>
          <ChipSelect options={APPEAL_CHOICES} value={appealStatus} onChange={setAppealStatus} />
          <FormField
            label="Outcome notes"
            value={appealOutcome}
            onChangeText={setAppealOutcome}
            placeholder="Explain the appeal decision"
            multiline
            numberOfLines={3}
            style={styles.multiline}
          />
          {appealError && <Text style={styles.error}>{appealError}</Text>}
          <Button label="Save Appeal Decision" onPress={handleAppealDecision} loading={appealSaving} />
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
            <View style={styles.commentHeader}>
              {c.author && (
                <Text style={styles.commentAuthor}>
                  {c.author.firstName} {c.author.lastName}
                  <Text style={styles.commentRole}> · {titleCase(c.author.role)}</Text>
                </Text>
              )}
              {c.isInternal && <StatusBadge label="Internal" tone="warning" />}
            </View>
            <Text style={styles.commentBody}>{c.body}</Text>
            <Text style={styles.timestamp}>{formatDateTime(c.createdAt)}</Text>
          </Card>
        ))
      )}

      <Card style={styles.headerCard}>
        <Text style={styles.sectionTitleInline}>Update Status</Text>
        <ChipSelect options={statusChoices} value={statusChoice} onChange={setStatusChoice} />
        <FormField
          label="Resolution steps"
          value={resolutionSteps}
          onChangeText={setResolutionSteps}
          placeholder="What was done to resolve this"
          multiline
          numberOfLines={2}
          style={styles.multiline}
        />
        <FormField
          label="Comment"
          value={comment}
          onChangeText={setComment}
          placeholder="Add a comment..."
          multiline
          numberOfLines={3}
          style={styles.multiline}
        />
        <View style={styles.switchRow}>
          <Text style={styles.fieldLabel}>Internal note (not visible to resident)</Text>
          <Switch value={isInternal} onValueChange={setIsInternal} />
        </View>
        {saveError && <Text style={styles.error}>{saveError}</Text>}
        {saveMessage && <Text style={styles.success}>{saveMessage}</Text>}
        <Button label="Save" onPress={handleSaveStatus} loading={saving} disabled={!hasStatusChanges} />
      </Card>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  headerCard: { gap: 8 },
  title: { fontSize: 18, fontWeight: '700', color: colors.text },
  meta: { fontSize: 13, color: colors.textMuted },
  description: { fontSize: 14, color: colors.text },
  timestamp: { fontSize: 12, color: colors.textFaint },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: colors.text, marginTop: 4 },
  sectionTitleInline: { fontSize: 15, fontWeight: '700', color: colors.text },
  fieldLabel: { fontSize: 13, fontWeight: '600', color: colors.textMuted },
  commentCard: { gap: 4 },
  commentHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  commentAuthor: { fontSize: 13, fontWeight: '600', color: colors.text },
  commentRole: { fontWeight: '400', color: colors.textMuted },
  commentBody: { fontSize: 14, color: colors.text },
  multiline: { minHeight: 60, textAlignVertical: 'top' },
  switchRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  error: { color: colors.danger, fontSize: 13 },
  success: { color: colors.success, fontSize: 13 },
});
