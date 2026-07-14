import { Stack } from 'expo-router';
import { colors } from '@/theme';

export default function ViolationsStackLayout() {
  return (
    <Stack screenOptions={{ headerStyle: { backgroundColor: colors.card }, headerTintColor: colors.text }}>
      <Stack.Screen name="index" options={{ title: 'Violations' }} />
      <Stack.Screen name="new" options={{ title: 'Issue Violation', presentation: 'modal' }} />
      <Stack.Screen name="[id]" options={{ title: 'Violation' }} />
    </Stack>
  );
}
