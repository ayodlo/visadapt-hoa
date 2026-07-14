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
import { getBoardArchRequest, decideBoardArchRequest } from '@/api/board';
import { ApiError } from '@/api/client';
import { colors } from '@/theme';
import { titleCase, formatDateTime } from '@/utils/format';
import { archStatusTone } from '@/utils/tones';
import type { BoardArchRequestDecisionInput } from '@/types/board';

const DECISION_STATUSES: { value: NonNullable<BoardArchRequestDecisionInput['status']> | ''; label: string }[] = [
  { value: '', label: 'No change' },
  { value: 'UNDER_REVIEW', label: 'Under Review' },
  { value: 'NEEDS_MORE_INFORMATION', label: 'Need More Info' },
  { value: 'APPROVED', label: 'Approve' },
  { value: 'DENIED', label: 'Deny' },
];

export default function BoardArchRequestDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data, loading, error, reload } = useApi(useCallback(() => getBoardArchRequest(id), [id]));

  const [statusChoice, setStatusChoice] = useState<NonNullable<BoardArchRequestDecisionInput['status']> | ''>('');
  const [ruleReference, setRuleReference] = useState('');
  const [decisionReason, setDecisionReason] = useState('');
  const [comment, setComment] = useState('');
  const [isInternal, setIsInternal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  async function handleSave() {
    setSaving(true);
    setSaveError(null);
    setSaveMessage(null);
    try {
      const input: BoardArchRequestDecisionInput = {};
      if (statusChoice) input.status = statusChoice;
      if (ruleReference.trim()) input.governingRuleReference = ruleReference.trim();
      if (decisionReason.trim()) input.decisionReason = decisionReason.trim();
      if (comment.trim()) {
        input.comment = comment.trim();
        input.isInternal = isInternal;
      }
      await decideBoardArchRequest(id, input);
      setStatusChoice('');
      setRuleReference('');
      setDecisionReason('');
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

  if (loading) return <LoadingView />;
  if (error || !data) return <ErrorView message={error ?? undefined} onRetry={reload} />;

  const request = data.request;
  const hasChanges = !!(statusChoice || ruleReference.trim() || decisionReason.trim() || comment.trim());

  return (
    <ScreenContainer>
      <Card style={styles.headerCard}>
        <StatusBadge label={request.status} tone={archStatusTone(request.status)} />
        <Text style={styles.title}>{titleCase(request.requestType)}</Text>
        <Text style={styles.meta}>
          {request.resident.firstName} {request.resident.lastName} · {request.resident.email}
        </Text>
        {request.property && (
          <Text style={styles.meta}>
            {request.property.streetAddress}
            {request.property.unitNumber ? `, Unit ${request.property.unitNumber}` : ''}
          </Text>
        )}
        <Text style={styles.description}>{request.description}</Text>
        {request.governingRuleReference && (
          <Text style={styles.meta}>Rule reference: {request.governingRuleReference}</Text>
        )}
        {request.decisionReason && <Text style={styles.meta}>Decision: {request.decisionReason}</Text>}
        <Text style={styles.timestamp}>Submitted {formatDateTime(request.createdAt)}</Text>
      </Card>

      <Text style={styles.sectionTitle}>Comments</Text>
      {request.comments.length === 0 ? (
        <Card>
          <EmptyState icon="💬" message="No comments yet" />
        </Card>
      ) : (
        request.comments.map((c) => (
          <Card key={c.id} style={styles.commentCard}>
            <View style={styles.commentHeader}>
              <Text style={styles.commentAuthor}>
                {c.author.firstName} {c.author.lastName}
                <Text style={styles.commentRole}> · {titleCase(c.author.role)}</Text>
              </Text>
              {c.isInternal && <StatusBadge label="Internal" tone="warning" />}
            </View>
            <Text style={styles.commentBody}>{c.body}</Text>
            <Text style={styles.timestamp}>{formatDateTime(c.createdAt)}</Text>
          </Card>
        ))
      )}

      <Card style={styles.headerCard}>
        <Text style={styles.sectionTitleInline}>Board Decision</Text>
        <Text style={styles.fieldLabel}>Status</Text>
        <ChipSelect options={DECISION_STATUSES} value={statusChoice} onChange={setStatusChoice} />
        <FormField label="Governing rule reference" value={ruleReference} onChangeText={setRuleReference} placeholder="e.g. CC&Rs Section 4.2" />
        <FormField
          label="Decision reason"
          value={decisionReason}
          onChangeText={setDecisionReason}
          placeholder="Explain the decision (shown to the resident)"
          multiline
          numberOfLines={3}
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
        <Button label="Save Decision" onPress={handleSave} loading={saving} disabled={!hasChanges} />
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
  multiline: { minHeight: 70, textAlignVertical: 'top' },
  switchRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  error: { color: colors.danger, fontSize: 13 },
  success: { color: colors.success, fontSize: 13 },
});
