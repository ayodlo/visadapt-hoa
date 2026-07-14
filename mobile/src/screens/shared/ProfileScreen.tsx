import { useState } from 'react';
import { StyleSheet, Text } from 'react-native';
import { ScreenContainer } from '@/components/ScreenContainer';
import { Card } from '@/components/Card';
import { FormField } from '@/components/FormField';
import { Button } from '@/components/Button';
import { useAuth } from '@/auth/AuthContext';
import { updateProfile, changePassword } from '@/api/profile';
import { ApiError } from '@/api/client';
import { colors } from '@/theme';
import { titleCase } from '@/utils/format';

export function ProfileScreen() {
  const { user, updateUser } = useAuth();
  const [firstName, setFirstName] = useState(user?.firstName ?? '');
  const [lastName, setLastName] = useState(user?.lastName ?? '');
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileMessage, setProfileMessage] = useState<{ text: string; isError: boolean } | null>(null);

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [passwordMessage, setPasswordMessage] = useState<{ text: string; isError: boolean } | null>(null);

  async function handleSaveProfile() {
    setProfileSaving(true);
    setProfileMessage(null);
    try {
      const { user: updated } = await updateProfile(firstName.trim(), lastName.trim());
      updateUser(updated);
      setProfileMessage({ text: 'Profile updated.', isError: false });
    } catch (e) {
      setProfileMessage({ text: e instanceof ApiError ? e.message : 'Failed to update profile.', isError: true });
    } finally {
      setProfileSaving(false);
    }
  }

  async function handleChangePassword() {
    setPasswordSaving(true);
    setPasswordMessage(null);
    try {
      await changePassword(currentPassword, newPassword);
      setCurrentPassword('');
      setNewPassword('');
      setPasswordMessage({ text: 'Password updated.', isError: false });
    } catch (e) {
      setPasswordMessage({ text: e instanceof ApiError ? e.message : 'Failed to update password.', isError: true });
    } finally {
      setPasswordSaving(false);
    }
  }

  return (
    <ScreenContainer>
      <Card style={styles.card}>
        <Text style={styles.sectionTitle}>Profile</Text>
        <Text style={styles.meta}>{user?.email} · {titleCase(user?.role ?? '')}</Text>
        <FormField label="First name" value={firstName} onChangeText={setFirstName} />
        <FormField label="Last name" value={lastName} onChangeText={setLastName} />
        {profileMessage && (
          <Text style={profileMessage.isError ? styles.error : styles.success}>{profileMessage.text}</Text>
        )}
        <Button
          label="Save Profile"
          onPress={handleSaveProfile}
          loading={profileSaving}
          disabled={!firstName.trim() || !lastName.trim()}
        />
      </Card>

      <Card style={styles.card}>
        <Text style={styles.sectionTitle}>Change Password</Text>
        <FormField label="Current password" value={currentPassword} onChangeText={setCurrentPassword} secureTextEntry />
        <FormField label="New password" value={newPassword} onChangeText={setNewPassword} secureTextEntry />
        {passwordMessage && (
          <Text style={passwordMessage.isError ? styles.error : styles.success}>{passwordMessage.text}</Text>
        )}
        <Button
          label="Update Password"
          variant="secondary"
          onPress={handleChangePassword}
          loading={passwordSaving}
          disabled={!currentPassword || newPassword.length < 8}
        />
      </Card>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  card: { gap: 10 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: colors.text },
  meta: { fontSize: 13, color: colors.textMuted },
  error: { color: colors.danger, fontSize: 13 },
  success: { color: colors.success, fontSize: 13 },
});
