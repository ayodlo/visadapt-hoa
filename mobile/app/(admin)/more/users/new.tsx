import { useState } from 'react';
import { StyleSheet, Text } from 'react-native';
import { router } from 'expo-router';
import { ScreenContainer } from '@/components/ScreenContainer';
import { FormField } from '@/components/FormField';
import { ChipSelect } from '@/components/ChipSelect';
import { CommunityMultiSelect } from '@/components/CommunityMultiSelect';
import { Button } from '@/components/Button';
import { createUser } from '@/api/admin';
import { ApiError } from '@/api/client';
import { useAuth } from '@/auth/AuthContext';
import { colors } from '@/theme';

const ROLES: { value: 'RESIDENT' | 'BOARD_MEMBER' | 'ADMIN'; label: string }[] = [
  { value: 'RESIDENT', label: 'Resident' },
  { value: 'BOARD_MEMBER', label: 'Board Member' },
  { value: 'ADMIN', label: 'Admin' },
];

export default function NewUser() {
  const { user: me, communities } = useAuth();
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<'RESIDENT' | 'BOARD_MEMBER' | 'ADMIN'>('RESIDENT');
  const [communityIds, setCommunityIds] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const valid = firstName.trim() && lastName.trim() && email.trim() && password.length >= 8;
  const showCommunityPicker = me?.role === 'SUPER_ADMIN' && role !== 'RESIDENT';

  function toggleCommunity(id: string) {
    setCommunityIds((prev) => (prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id]));
  }

  async function handleSubmit() {
    setError(null);
    setSubmitting(true);
    try {
      await createUser({
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        email: email.trim(),
        password,
        role,
        ...(showCommunityPicker && communityIds.length ? { communityIds } : {}),
      });
      router.replace('/more/users');
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Something went wrong. Try again.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <ScreenContainer>
      <FormField label="First name" value={firstName} onChangeText={setFirstName} />
      <FormField label="Last name" value={lastName} onChangeText={setLastName} />
      <FormField label="Email" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" />
      <FormField label="Password" value={password} onChangeText={setPassword} secureTextEntry placeholder="At least 8 characters" />
      <Text style={styles.fieldLabel}>Role</Text>
      <ChipSelect options={ROLES} value={role} onChange={setRole} />
      {showCommunityPicker && (
        <>
          <Text style={styles.fieldLabel}>Communities (defaults to your active community if none selected)</Text>
          <CommunityMultiSelect communities={communities} selected={communityIds} onToggle={toggleCommunity} />
        </>
      )}
      {error && <Text style={styles.error}>{error}</Text>}
      <Button label="Create User" onPress={handleSubmit} loading={submitting} disabled={!valid} />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  fieldLabel: { fontSize: 13, fontWeight: '600', color: colors.textMuted },
  error: { color: colors.danger, fontSize: 14 },
});
