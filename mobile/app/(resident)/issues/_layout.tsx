import { Stack } from 'expo-router';
import { colors } from '@/theme';

export default function IssuesStackLayout() {
  return (
    <Stack screenOptions={{ headerStyle: { backgroundColor: colors.card }, headerTintColor: colors.text }}>
      <Stack.Screen name="index" options={{ title: 'My Issues' }} />
      <Stack.Screen name="new" options={{ title: 'Report an Issue', presentation: 'modal' }} />
      <Stack.Screen name="[id]" options={{ title: 'Issue' }} />
    </Stack>
  );
}
