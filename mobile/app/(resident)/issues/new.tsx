import { useState } from 'react';
import { StyleSheet, Text } from 'react-native';
import { router } from 'expo-router';
import { ScreenContainer } from '@/components/ScreenContainer';
import { FormField } from '@/components/FormField';
import { ChipSelect } from '@/components/ChipSelect';
import { Button } from '@/components/Button';
import { createIssue } from '@/api/issues';
import { ApiError } from '@/api/client';
import { colors } from '@/theme';
import type { IssueCategory, IssuePriority } from '@/types/enums';

const CATEGORIES: { value: IssueCategory; label: string }[] = [
  { value: 'LANDSCAPING', label: 'Landscaping' },
  { value: 'MAINTENANCE', label: 'Maintenance' },
  { value: 'PARKING', label: 'Parking' },
  { value: 'SAFETY', label: 'Safety' },
  { value: 'NOISE', label: 'Noise' },
  { value: 'GATE_ACCESS', label: 'Gate Access' },
  { value: 'TRASH', label: 'Trash' },
  { value: 'OTHER', label: 'Other' },
];

const PRIORITIES: { value: IssuePriority; label: string }[] = [
  { value: 'LOW', label: 'Low' },
  { value: 'MEDIUM', label: 'Medium' },
  { value: 'HIGH', label: 'High' },
  { value: 'URGENT', label: 'Urgent' },
];

const CONTACT_METHODS: { value: 'Email' | 'Phone' | 'Text'; label: string }[] = [
  { value: 'Email', label: 'Email' },
  { value: 'Phone', label: 'Phone' },
  { value: 'Text', label: 'Text' },
];

export default function NewIssue() {
  const [category, setCategory] = useState<IssueCategory>('MAINTENANCE');
  const [priority, setPriority] = useState<IssuePriority>('MEDIUM');
  const [contact, setContact] = useState<'Email' | 'Phone' | 'Text'>('Email');
  const [title, setTitle] = useState('');
  const [location, setLocation] = useState('');
  const [description, setDescription] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const valid = title.trim().length >= 5 && location.trim().length >= 3 && description.trim().length >= 10;

  async function handleSubmit() {
    setError(null);
    setSubmitting(true);
    try {
      const { issue } = await createIssue({
        category,
        title: title.trim(),
        location: location.trim(),
        description: description.trim(),
        priority,
        preferredContactMethod: contact,
      });
      router.replace(`/issues/${issue.id}`);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Something went wrong. Try again.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <ScreenContainer>
      <Text style={styles.fieldLabel}>Category</Text>
      <ChipSelect options={CATEGORIES} value={category} onChange={setCategory} />

      <FormField label="Title" value={title} onChangeText={setTitle} placeholder="Short summary" maxLength={200} />
      <FormField label="Location" value={location} onChangeText={setLocation} placeholder="e.g. Building 3, Unit 12" maxLength={300} />
      <FormField
        label="Description"
        value={description}
        onChangeText={setDescription}
        placeholder="Describe the issue in detail"
        multiline
        numberOfLines={4}
        style={styles.multiline}
      />

      <Text style={styles.fieldLabel}>Priority</Text>
      <ChipSelect options={PRIORITIES} value={priority} onChange={setPriority} />

      <Text style={styles.fieldLabel}>Preferred contact method</Text>
      <ChipSelect options={CONTACT_METHODS} value={contact} onChange={setContact} />

      {error && <Text style={styles.error}>{error}</Text>}

      <Button label="Submit Issue" onPress={handleSubmit} loading={submitting} disabled={!valid} />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  fieldLabel: { fontSize: 13, fontWeight: '600', color: colors.textMuted, marginTop: 4 },
  multiline: { minHeight: 90, textAlignVertical: 'top' },
  error: { color: colors.danger, fontSize: 14 },
});
