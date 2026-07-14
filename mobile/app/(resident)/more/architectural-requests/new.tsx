import { useState } from 'react';
import { StyleSheet, Text } from 'react-native';
import { router } from 'expo-router';
import { ScreenContainer } from '@/components/ScreenContainer';
import { FormField } from '@/components/FormField';
import { ChipSelect } from '@/components/ChipSelect';
import { Button } from '@/components/Button';
import { createArchRequest } from '@/api/architecturalRequests';
import { ApiError } from '@/api/client';
import { colors } from '@/theme';
import type { ArchitecturalRequestType } from '@/types/enums';

const TYPES: { value: ArchitecturalRequestType; label: string }[] = [
  { value: 'FENCE', label: 'Fence' },
  { value: 'EXTERIOR_PAINT', label: 'Exterior Paint' },
  { value: 'LANDSCAPING', label: 'Landscaping' },
  { value: 'SOLAR', label: 'Solar' },
  { value: 'ROOF', label: 'Roof' },
  { value: 'SHED', label: 'Shed' },
  { value: 'OTHER', label: 'Other' },
];

export default function NewArchRequest() {
  const [requestType, setRequestType] = useState<ArchitecturalRequestType>('FENCE');
  const [description, setDescription] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const valid = description.trim().length >= 20;

  async function submit(submitNow: boolean) {
    setError(null);
    setSubmitting(true);
    try {
      const { request } = await createArchRequest({ requestType, description: description.trim(), submitNow });
      router.replace(`/more/architectural-requests/${request.id}`);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Something went wrong. Try again.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <ScreenContainer>
      <Text style={styles.fieldLabel}>Request Type</Text>
      <ChipSelect options={TYPES} value={requestType} onChange={setRequestType} />

      <FormField
        label="Description"
        value={description}
        onChangeText={setDescription}
        placeholder="Describe the change you'd like to make (min 20 characters)"
        multiline
        numberOfLines={5}
        style={styles.multiline}
      />

      {error && <Text style={styles.error}>{error}</Text>}

      <Button label="Save as Draft" variant="secondary" onPress={() => submit(false)} loading={submitting} disabled={!valid} />
      <Button label="Submit for Review" onPress={() => submit(true)} loading={submitting} disabled={!valid} />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  fieldLabel: { fontSize: 13, fontWeight: '600', color: colors.textMuted },
  multiline: { minHeight: 110, textAlignVertical: 'top' },
  error: { color: colors.danger, fontSize: 14 },
});
