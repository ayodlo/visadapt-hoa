import { Stack } from 'expo-router';
import { colors } from '@/theme';

export default function PaymentsStackLayout() {
  return (
    <Stack screenOptions={{ headerStyle: { backgroundColor: colors.card }, headerTintColor: colors.text }}>
      <Stack.Screen name="index" options={{ title: 'Payments' }} />
      <Stack.Screen name="pay" options={{ title: 'Make a Payment', presentation: 'modal' }} />
    </Stack>
  );
}
