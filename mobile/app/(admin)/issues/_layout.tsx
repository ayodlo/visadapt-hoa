import { Stack } from 'expo-router';
import { colors } from '@/theme';

export default function IssuesStackLayout() {
  return (
    <Stack screenOptions={{ headerStyle: { backgroundColor: colors.card }, headerTintColor: colors.text }}>
      <Stack.Screen name="index" options={{ title: 'Issues' }} />
      <Stack.Screen name="[id]" options={{ title: 'Issue' }} />
    </Stack>
  );
}
