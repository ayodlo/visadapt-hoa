import { useCallback, useState } from 'react';
import { StyleSheet, Text } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { ScreenContainer } from '@/components/ScreenContainer';
import { Card } from '@/components/Card';
import { StatusBadge } from '@/components/StatusBadge';
import { LoadingView } from '@/components/LoadingView';
import { ErrorView } from '@/components/ErrorView';
import { EmptyState } from '@/components/EmptyState';
import { ChipSelect } from '@/components/ChipSelect';
import { Button } from '@/components/Button';
import { useApi } from '@/hooks/useApi';
import { updateAdminIssue, listVendorOptions, listUsers } from '@/api/admin';
import { ApiError } from '@/api/client';
import { colors } from '@/theme';
import { titleCase, formatDateTime } from '@/utils/format';
import { issueStatusTone, issuePriorityTone } from '@/utils/tones';
import type { IssueStatus, IssuePriority } from '@/types/enums';

const STATUS_CHOICES: { value: IssueStatus | ''; label: string }[] = [
  { value: '', label: 'No change' },
  { value: 'SUBMITTED', label: 'Submitted' },
  { value: 'UNDER_REVIEW', label: 'Under Review' },
  { value: 'ASSIGNED', label: 'Assigned' },
  { value: 'IN_PROGRESS', label: 'In Progress' },
  { value: 'WAITING_ON_VENDOR', label: 'Waiting on Vendor' },
  { value: 'RESOLVED', label: 'Resolved' },
  { value: 'CLOSED', label: 'Closed' },
];

const PRIORITY_CHOICES: { value: IssuePriority | ''; label: string }[] = [
  { value: '', label: 'No change' },
  { value: 'LOW', label: 'Low' },
  { value: 'MEDIUM', label: 'Medium' },
  { value: 'HIGH', label: 'High' },
  { value: 'URGENT', label: 'Urgent' },
];

const UNASSIGN = '__unassign__';

export default function AdminIssueDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data, loading, error, reload } = useApi(useCallback(() => updateAdminIssue(id, {}), [id]));
  const { data: staff } = useApi(listUsers);
  const { data: vendors } = useApi(listVendorOptions);

  const [statusChoice, setStatusChoice] = useState<IssueStatus | ''>('');
  const [priorityChoice, setPriorityChoice] = useState<IssuePriority | ''>('');
  const [assignedChoice, setAssignedChoice] = useState('');
  const [vendorChoice, setVendorChoice] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  async function handleSave() {
    setSaving(true);
    setSaveError(null);
    setSaveMessage(null);
    try {
      const input: Parameters<typeof updateAdminIssue>[1] = {};
      if (statusChoice) input.status = statusChoice;
      if (priorityChoice) input.priority = priorityChoice;
      if (assignedChoice === UNASSIGN) input.assignedToId = null;
      else if (assignedChoice) input.assignedToId = assignedChoice;
      if (vendorChoice === UNASSIGN) input.vendorId = null;
      else if (vendorChoice) input.vendorId = vendorChoice;

      await updateAdminIssue(id, input);
      setStatusChoice('');
      setPriorityChoice('');
      setAssignedChoice('');
      setVendorChoice('');
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

  const issue = data.issue;
  const staffOptions = [
    { value: '', label: 'No change' },
    { value: UNASSIGN, label: 'Unassigned' },
    ...(staff ?? [])
      .filter((u) => u.role !== 'RESIDENT')
      .map((u) => ({ value: u.id, label: `${u.firstName} ${u.lastName}` })),
  ];
  const vendorOptions = [
    { value: '', label: 'No change' },
    { value: UNASSIGN, label: 'None' },
    ...(vendors?.vendors ?? []).map((v) => ({ value: v.id, label: v.name })),
  ];
  const hasChanges = !!(statusChoice || priorityChoice || assignedChoice || vendorChoice);

  return (
    <ScreenContainer>
      <Card style={styles.headerCard}>
        <StatusBadge label={issue.status} tone={issueStatusTone(issue.status)} />
        <StatusBadge label={issue.priority} tone={issuePriorityTone(issue.priority)} />
        <Text style={styles.title}>{issue.title}</Text>
        <Text style={styles.meta}>
          {issue.resident.firstName} {issue.resident.lastName} · {issue.resident.email}
        </Text>
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
          </Card>
        ))
      )}

      <Card style={styles.headerCard}>
        <Text style={styles.sectionTitleInline}>Manage</Text>
        <Text style={styles.fieldLabel}>Status</Text>
        <ChipSelect options={STATUS_CHOICES} value={statusChoice} onChange={setStatusChoice} />
        <Text style={styles.fieldLabel}>Priority</Text>
        <ChipSelect options={PRIORITY_CHOICES} value={priorityChoice} onChange={setPriorityChoice} />
        <Text style={styles.fieldLabel}>Assign To</Text>
        <ChipSelect options={staffOptions} value={assignedChoice} onChange={setAssignedChoice} />
        <Text style={styles.fieldLabel}>Vendor</Text>
        <ChipSelect options={vendorOptions} value={vendorChoice} onChange={setVendorChoice} />
        {saveError && <Text style={styles.error}>{saveError}</Text>}
        {saveMessage && <Text style={styles.success}>{saveMessage}</Text>}
        <Button label="Save" onPress={handleSave} loading={saving} disabled={!hasChanges} />
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
  commentAuthor: { fontSize: 13, fontWeight: '600', color: colors.text },
  commentRole: { fontWeight: '400', color: colors.textMuted },
  commentBody: { fontSize: 14, color: colors.text },
  error: { color: colors.danger, fontSize: 13 },
  success: { color: colors.success, fontSize: 13 },
});
