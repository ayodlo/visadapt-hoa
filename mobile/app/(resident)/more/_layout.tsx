import { Stack } from 'expo-router';
import { colors } from '@/theme';

export default function MoreStackLayout() {
  return (
    <Stack screenOptions={{ headerStyle: { backgroundColor: colors.card }, headerTintColor: colors.text }}>
      <Stack.Screen name="index" options={{ title: 'More' }} />
      <Stack.Screen name="announcements/index" options={{ title: 'Announcements' }} />
      <Stack.Screen name="announcements/[id]" options={{ title: 'Announcement' }} />
      <Stack.Screen name="events/index" options={{ title: 'Events' }} />
      <Stack.Screen name="events/[id]" options={{ title: 'Event' }} />
      <Stack.Screen name="architectural-requests/index" options={{ title: 'Architectural Requests' }} />
      <Stack.Screen name="architectural-requests/new" options={{ title: 'New Request', presentation: 'modal' }} />
      <Stack.Screen name="architectural-requests/[id]" options={{ title: 'Request' }} />
      <Stack.Screen name="violations/index" options={{ title: 'Violations' }} />
      <Stack.Screen name="violations/[id]" options={{ title: 'Violation' }} />
      <Stack.Screen name="documents/index" options={{ title: 'Documents' }} />
      <Stack.Screen name="documents/[id]" options={{ title: 'Document' }} />
      <Stack.Screen name="polls/index" options={{ title: 'Polls' }} />
      <Stack.Screen name="polls/[id]" options={{ title: 'Poll' }} />
      <Stack.Screen name="profile/index" options={{ title: 'Profile' }} />
    </Stack>
  );
}
