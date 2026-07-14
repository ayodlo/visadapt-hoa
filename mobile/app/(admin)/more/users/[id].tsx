import { useCallback, useState } from 'react';
import { Alert, StyleSheet, Text } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { ScreenContainer } from '@/components/ScreenContainer';
import { Card } from '@/components/Card';
import { FormField } from '@/components/FormField';
import { ChipSelect } from '@/components/ChipSelect';
import { Button } from '@/components/Button';
import { LoadingView } from '@/components/LoadingView';
import { ErrorView } from '@/components/ErrorView';
import { useApi } from '@/hooks/useApi';
import { listUsers, updateUser, deleteUser } from '@/api/admin';
import { useAuth } from '@/auth/AuthContext';
import { ApiError } from '@/api/client';
import { colors } from '@/theme';

const ROLES: { value: 'RESIDENT' | 'BOARD_MEMBER' | 'ADMIN'; label: string }[] = [
  { value: 'RESIDENT', label: 'Resident' },
  { value: 'BOARD_MEMBER', label: 'Board Member' },
  { value: 'ADMIN', label: 'Admin' },
];

export default function EditUser() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user: me } = useAuth();
  const { data: users, loading, error, reload } = useApi(useCallback(() => listUsers(), []));

  const target = users?.find((u) => u.id === id);
  const [firstName, setFirstName] = useState<string | null>(null);
  const [lastName, setLastName] = useState<string | null>(null);
  const [role, setRole] = useState<'RESIDENT' | 'BOARD_MEMBER' | 'ADMIN' | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  if (loading) return <LoadingView />;
  if (error || !users) return <ErrorView message={error ?? undefined} onRetry={reload} />;
  if (!target) return <ErrorView message="User not found." />;

  const isSelf = me?.id === target.id;
  const isSuperAdmin = target.role === 'SUPER_ADMIN';
  const canManage = !isSuperAdmin;

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

      {canManage && !isSelf && <Button label="Delete User" variant="danger" onPress={confirmDelete} />}
      {isSelf && <Text style={styles.info}>You cannot delete your own account.</Text>}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  card: { gap: 10 },
  meta: { fontSize: 13, color: colors.textMuted },
  info: { fontSize: 13, color: colors.textMuted, fontStyle: 'italic' },
  fieldLabel: { fontSize: 13, fontWeight: '600', color: colors.textMuted },
  error: { color: colors.danger, fontSize: 13 },
  success: { color: colors.success, fontSize: 13 },
});
