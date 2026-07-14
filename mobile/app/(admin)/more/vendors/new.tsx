import { useState } from 'react';
import { StyleSheet, Text } from 'react-native';
import { router } from 'expo-router';
import { ScreenContainer } from '@/components/ScreenContainer';
import { FormField } from '@/components/FormField';
import { Button } from '@/components/Button';
import { createVendor } from '@/api/admin';
import { ApiError } from '@/api/client';
import { colors } from '@/theme';

export default function NewVendor() {
  const [name, setName] = useState('');
  const [contactName, setContactName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [category, setCategory] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit() {
    setError(null);
    setSubmitting(true);
    try {
      await createVendor({
        name: name.trim(),
        contactName: contactName.trim() || undefined,
        email: email.trim() || undefined,
        phone: phone.trim() || undefined,
        category: category.trim() || undefined,
      });
      router.replace('/more/vendors');
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Something went wrong. Try again.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <ScreenContainer>
      <FormField label="Name" value={name} onChangeText={setName} placeholder="Vendor company name" />
      <FormField label="Contact name" value={contactName} onChangeText={setContactName} placeholder="Primary contact" />
      <FormField label="Email" value={email} onChangeText={setEmail} placeholder="contact@vendor.com" keyboardType="email-address" autoCapitalize="none" />
      <FormField label="Phone" value={phone} onChangeText={setPhone} placeholder="(555) 555-5555" keyboardType="phone-pad" />
      <FormField label="Category" value={category} onChangeText={setCategory} placeholder="e.g. Landscaping" />
      {error && <Text style={styles.error}>{error}</Text>}
      <Button label="Add Vendor" onPress={handleSubmit} loading={submitting} disabled={!name.trim()} />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  error: { color: colors.danger, fontSize: 14 },
});
