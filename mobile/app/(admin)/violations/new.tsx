import { useState } from 'react';
import { StyleSheet, Switch, Text, View } from 'react-native';
import { router } from 'expo-router';
import { ScreenContainer } from '@/components/ScreenContainer';
import { FormField } from '@/components/FormField';
import { ChipSelect } from '@/components/ChipSelect';
import { ListCard } from '@/components/ListCard';
import { ListRow } from '@/components/ListRow';
import { Button } from '@/components/Button';
import { useApi } from '@/hooks/useApi';
import { listUsers, createViolation } from '@/api/admin';
import { ApiError } from '@/api/client';
import { colors } from '@/theme';
import type { ViolationType } from '@/types/enums';

const TYPES: { value: ViolationType; label: string }[] = [
  { value: 'LANDSCAPING_MAINTENANCE', label: 'Landscaping' },
  { value: 'PARKING', label: 'Parking' },
  { value: 'NOISE', label: 'Noise' },
  { value: 'PROPERTY_APPEARANCE', label: 'Property Appearance' },
  { value: 'UNAUTHORIZED_MODIFICATION', label: 'Unauthorized Mod.' },
  { value: 'PET_VIOLATION', label: 'Pet' },
  { value: 'TRASH_AND_DEBRIS', label: 'Trash & Debris' },
  { value: 'OTHER', label: 'Other' },
];

export default function NewViolation() {
  const { data: users } = useApi(listUsers);
  const [residentSearch, setResidentSearch] = useState('');
  const [residentId, setResidentId] = useState<string | null>(null);

  const [violationType, setViolationType] = useState<ViolationType>('OTHER');
  const [ruleCitation, setRuleCitation] = useState('');
  const [description, setDescription] = useState('');
  const [resolutionSteps, setResolutionSteps] = useState('');
  const [sendNow, setSendNow] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const residents = (users ?? []).filter((u) => u.role === 'RESIDENT');
  const filteredResidents = residentSearch
    ? residents.filter((r) => `${r.firstName} ${r.lastName} ${r.email}`.toLowerCase().includes(residentSearch.toLowerCase()))
    : residents;
  const selectedResident = residents.find((r) => r.id === residentId);

  const valid = !!residentId && ruleCitation.trim().length >= 3 && description.trim().length >= 10;

  async function handleSubmit() {
    if (!residentId) return;
    setError(null);
    setSubmitting(true);
    try {
      await createViolation({
        residentId,
        violationType,
        ruleCitation: ruleCitation.trim(),
        description: description.trim(),
        observedAt: new Date().toISOString(),
        resolutionSteps: resolutionSteps.trim() || undefined,
        sendNow,
      });
      router.replace('/violations');
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Something went wrong. Try again.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <ScreenContainer>
      <Text style={styles.fieldLabel}>Resident</Text>
      {selectedResident ? (
        <ListCard>
          <ListRow
            title={`${selectedResident.firstName} ${selectedResident.lastName}`}
            subtitle={selectedResident.email}
            onPress={() => setResidentId(null)}
          />
        </ListCard>
      ) : (
        <>
          <FormField label="Search residents" value={residentSearch} onChangeText={setResidentSearch} placeholder="Name or email" />
          <ListCard>
            {filteredResidents.slice(0, 20).map((r) => (
              <ListRow
                key={r.id}
                title={`${r.firstName} ${r.lastName}`}
                subtitle={r.email}
                onPress={() => setResidentId(r.id)}
              />
            ))}
          </ListCard>
        </>
      )}

      <Text style={styles.fieldLabel}>Violation Type</Text>
      <ChipSelect options={TYPES} value={violationType} onChange={setViolationType} />

      <FormField label="Rule citation" value={ruleCitation} onChangeText={setRuleCitation} placeholder="e.g. CC&Rs Section 6.1" />
      <FormField
        label="Description"
        value={description}
        onChangeText={setDescription}
        placeholder="Describe the violation (min 10 characters)"
        multiline
        numberOfLines={4}
        style={styles.multiline}
      />
      <FormField
        label="Resolution steps (optional)"
        value={resolutionSteps}
        onChangeText={setResolutionSteps}
        placeholder="What the resident should do"
        multiline
        numberOfLines={2}
        style={styles.multiline}
      />

      <View style={styles.switchRow}>
        <Text style={styles.fieldLabel}>Send notice immediately</Text>
        <Switch value={sendNow} onValueChange={setSendNow} />
      </View>

      {error && <Text style={styles.error}>{error}</Text>}
      <Button label={sendNow ? 'Issue Violation' : 'Save as Draft'} onPress={handleSubmit} loading={submitting} disabled={!valid} />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  fieldLabel: { fontSize: 13, fontWeight: '600', color: colors.textMuted, marginTop: 4 },
  multiline: { minHeight: 80, textAlignVertical: 'top' },
  switchRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  error: { color: colors.danger, fontSize: 14 },
});
