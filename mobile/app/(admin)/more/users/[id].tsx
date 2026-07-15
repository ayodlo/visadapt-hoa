import { useCallback, useEffect, useState } from 'react';
import { Alert, StyleSheet, Text } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { ScreenContainer } from '@/components/ScreenContainer';
import { Card } from '@/components/Card';
import { ListCard } from '@/components/ListCard';
import { ListRow } from '@/components/ListRow';
import { FormField } from '@/components/FormField';
import { ChipSelect } from '@/components/ChipSelect';
import { CommunityMultiSelect } from '@/components/CommunityMultiSelect';
import { Button } from '@/components/Button';
import { LoadingView } from '@/components/LoadingView';
import { ErrorView } from '@/components/ErrorView';
import { useApi } from '@/hooks/useApi';
import { getUser, updateUser, deleteUser } from '@/api/admin';
import { updateUserCommunities } from '@/api/community';
import { listProperties, createProperty, deleteProperty } from '@/api/properties';
import { useAuth } from '@/auth/AuthContext';
import { ApiError } from '@/api/client';
import { colors } from '@/theme';
import type { Property } from '@/types/community';

const ROLES: { value: 'RESIDENT' | 'BOARD_MEMBER' | 'ADMIN'; label: string }[] = [
  { value: 'RESIDENT', label: 'Resident' },
  { value: 'BOARD_MEMBER', label: 'Board Member' },
  { value: 'ADMIN', label: 'Admin' },
];

const EMPTY_PROPERTY = { streetAddress: '', unitNumber: '', city: '', state: '', zipCode: '' };

export default function EditUser() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user: me, communities } = useAuth();
  const { data: target, loading, error, reload } = useApi(useCallback(() => getUser(id), [id]));

  const [firstName, setFirstName] = useState<string | null>(null);
  const [lastName, setLastName] = useState<string | null>(null);
  const [role, setRole] = useState<'RESIDENT' | 'BOARD_MEMBER' | 'ADMIN' | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  const [communityIds, setCommunityIds] = useState<string[] | null>(null);
  const [savingCommunities, setSavingCommunities] = useState(false);

  const [properties, setProperties] = useState<Property[]>([]);
  const [propertiesLoaded, setPropertiesLoaded] = useState(false);
  const [showPropertyForm, setShowPropertyForm] = useState(false);
  const [propertyForm, setPropertyForm] = useState(EMPTY_PROPERTY);
  const [propertySubmitting, setPropertySubmitting] = useState(false);
  const [propertyError, setPropertyError] = useState<string | null>(null);

  const loadProperties = useCallback(async () => {
    const result = await listProperties(id);
    setProperties(result);
    setPropertiesLoaded(true);
  }, [id]);

  useEffect(() => {
    // Same legitimate Effect pattern as useApi's load(): the setState calls
    // inside loadProperties happen asynchronously after `await listProperties()`,
    // not synchronously within this effect body.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (target?.role === 'RESIDENT') void loadProperties();
  }, [target?.role, loadProperties]);

  if (loading) return <LoadingView />;
  if (error || !target) return <ErrorView message={error ?? undefined} onRetry={reload} />;

  const isSelf = me?.id === target.id;
  const isSuperAdmin = target.role === 'SUPER_ADMIN';
  const canManage = !isSuperAdmin;
  const isStaffTarget = target.role === 'ADMIN' || target.role === 'BOARD_MEMBER';
  const selectedCommunityIds = communityIds ?? target.communityAssignments?.map((a) => a.communityId) ?? [];

  function toggleCommunity(communityId: string) {
    setCommunityIds((prev) => {
      const current = prev ?? target!.communityAssignments?.map((a) => a.communityId) ?? [];
      return current.includes(communityId) ? current.filter((c) => c !== communityId) : [...current, communityId];
    });
  }

  async function handleSave() {
    setSaving(true);
    setSaveError(null);
    setSaveMessage(null);
    try {
      await updateUser(id, {
        firstName: firstName ?? undefined,
        lastName: lastName ?? undefined,
        role: role ?? undefined,
      });
      setSaveMessage('Saved.');
      await reload();
    } catch (e) {
      setSaveError(e instanceof ApiError ? e.message : 'Failed to save.');
    } finally {
      setSaving(false);
    }
  }

  async function handleSaveCommunities() {
    if (selectedCommunityIds.length === 0) {
      setSaveError('At least one community is required.');
      return;
    }
    setSavingCommunities(true);
    setSaveError(null);
    try {
      await updateUserCommunities(id, selectedCommunityIds);
      setCommunityIds(null);
      setSaveMessage('Community assignments updated.');
      await reload();
    } catch (e) {
      setSaveError(e instanceof ApiError ? e.message : 'Failed to update assignments.');
    } finally {
      setSavingCommunities(false);
    }
  }

  async function handleAddProperty() {
    setPropertySubmitting(true);
    setPropertyError(null);
    try {
      await createProperty({ ownerId: id, ...propertyForm });
      setPropertyForm(EMPTY_PROPERTY);
      setShowPropertyForm(false);
      await loadProperties();
    } catch (e) {
      setPropertyError(e instanceof ApiError ? e.message : 'Could not add property.');
    } finally {
      setPropertySubmitting(false);
    }
  }

  function confirmRemoveProperty(propertyId: string, address: string) {
    Alert.alert('Remove property', `Remove ${address}? This cannot be undone.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          await deleteProperty(propertyId);
          await loadProperties();
        },
      },
    ]);
  }

  function confirmDelete() {
    Alert.alert('Delete user', `Delete ${target!.firstName} ${target!.lastName}? This cannot be undone.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteUser(id);
            router.replace('/more/users');
          } catch (e) {
            setSaveError(e instanceof ApiError ? e.message : 'Failed to delete.');
          }
        },
      },
    ]);
  }

  return (
    <ScreenContainer>
      <Card style={styles.card}>
        <Text style={styles.meta}>{target.email}</Text>
        {isSuperAdmin && <Text style={styles.info}>SUPER_ADMIN accounts cannot be edited here.</Text>}
        <FormField
          label="First name"
          value={firstName ?? target.firstName}
          onChangeText={setFirstName}
          editable={canManage}
        />
        <FormField
          label="Last name"
          value={lastName ?? target.lastName}
          onChangeText={setLastName}
          editable={canManage}
        />
        {canManage && (
          <>
            <Text style={styles.fieldLabel}>Role</Text>
            <ChipSelect options={ROLES} value={role ?? (target.role as 'RESIDENT' | 'BOARD_MEMBER' | 'ADMIN')} onChange={setRole} />
          </>
        )}
        {saveError && <Text style={styles.error}>{saveError}</Text>}
        {saveMessage && <Text style={styles.success}>{saveMessage}</Text>}
        {canManage && <Button label="Save" onPress={handleSave} loading={saving} />}
      </Card>

      {target.role === 'RESIDENT' && (
        <Card style={styles.card}>
          <Text style={styles.sectionTitle}>Community</Text>
          <Text style={styles.meta}>{target.community?.name ?? '—'}</Text>
        </Card>
      )}

      {isStaffTarget && (
        <Card style={styles.card}>
          <Text style={styles.sectionTitle}>Community Assignments</Text>
          {me?.role === 'SUPER_ADMIN' ? (
            <>
              <CommunityMultiSelect communities={communities} selected={selectedCommunityIds} onToggle={toggleCommunity} />
              <Button label="Save Assignments" onPress={handleSaveCommunities} loading={savingCommunities} />
            </>
          ) : (
            (target.communityAssignments ?? []).map((a) => (
              <Text key={a.communityId} style={styles.meta}>{a.community.name}</Text>
            ))
          )}
        </Card>
      )}

      {target.role === 'RESIDENT' && (
        <Card style={styles.card}>
          <Text style={styles.sectionTitle}>Properties</Text>
          {!propertiesLoaded ? (
            <Text style={styles.info}>Loading…</Text>
          ) : properties.length === 0 ? (
            <Text style={styles.info}>No properties on file.</Text>
          ) : (
            <ListCard>
              {properties.map((p) => (
                <ListRow
                  key={p.id}
                  title={`${p.streetAddress}${p.unitNumber ? ` #${p.unitNumber}` : ''}`}
                  subtitle={`${p.city}, ${p.state} ${p.zipCode}`}
                  right={<Text style={styles.remove} onPress={() => confirmRemoveProperty(p.id, p.streetAddress)}>Remove</Text>}
                />
              ))}
            </ListCard>
          )}
          {showPropertyForm ? (
            <>
              <FormField label="Street address" value={propertyForm.streetAddress} onChangeText={(v) => setPropertyForm((f) => ({ ...f, streetAddress: v }))} />
              <FormField label="Unit number (optional)" value={propertyForm.unitNumber} onChangeText={(v) => setPropertyForm((f) => ({ ...f, unitNumber: v }))} />
              <FormField label="City" value={propertyForm.city} onChangeText={(v) => setPropertyForm((f) => ({ ...f, city: v }))} />
              <FormField label="State" value={propertyForm.state} onChangeText={(v) => setPropertyForm((f) => ({ ...f, state: v }))} />
              <FormField label="Zip code" value={propertyForm.zipCode} onChangeText={(v) => setPropertyForm((f) => ({ ...f, zipCode: v }))} />
              {propertyError && <Text style={styles.error}>{propertyError}</Text>}
              <Button
                label="Add Property"
                onPress={handleAddProperty}
                loading={propertySubmitting}
                disabled={!propertyForm.streetAddress.trim() || !propertyForm.city.trim() || !propertyForm.state.trim() || !propertyForm.zipCode.trim()}
              />
              <Button label="Cancel" variant="secondary" onPress={() => { setShowPropertyForm(false); setPropertyError(null); }} />
            </>
          ) : (
            <Button label="+ Add Property" variant="secondary" onPress={() => setShowPropertyForm(true)} />
          )}
        </Card>
      )}

      {canManage && !isSelf && <Button label="Delete User" variant="danger" onPress={confirmDelete} />}
      {isSelf && <Text style={styles.info}>You cannot delete your own account.</Text>}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  card: { gap: 10 },
  meta: { fontSize: 13, color: colors.textMuted },
  info: { fontSize: 13, color: colors.textMuted, fontStyle: 'italic' },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: colors.text },
  fieldLabel: { fontSize: 13, fontWeight: '600', color: colors.textMuted },
  error: { color: colors.danger, fontSize: 13 },
  success: { color: colors.success, fontSize: 13 },
  remove: { color: colors.danger, fontSize: 13 },
});
