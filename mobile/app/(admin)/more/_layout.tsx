import { Stack } from 'expo-router';
import { colors } from '@/theme';

export default function MoreStackLayout() {
  return (
    <Stack screenOptions={{ headerStyle: { backgroundColor: colors.card }, headerTintColor: colors.text }}>
      <Stack.Screen name="index" options={{ title: 'More' }} />
      <Stack.Screen name="users/index" options={{ title: 'Users' }} />
      <Stack.Screen name="users/new" options={{ title: 'New User', presentation: 'modal' }} />
      <Stack.Screen name="users/[id]" options={{ title: 'Edit User' }} />
      <Stack.Screen name="vendors/index" options={{ title: 'Vendors' }} />
      <Stack.Screen name="vendors/new" options={{ title: 'New Vendor', presentation: 'modal' }} />
      <Stack.Screen name="reports/index" options={{ title: 'Reports' }} />
      <Stack.Screen name="reports/issues" options={{ title: 'Issues Report' }} />
      <Stack.Screen name="reports/payments" options={{ title: 'Payments Report' }} />
      <Stack.Screen name="reports/architectural-requests" options={{ title: 'Architectural Requests Report' }} />
      <Stack.Screen name="reports/violations" options={{ title: 'Violations Report' }} />
      <Stack.Screen name="announcements/index" options={{ title: 'Announcements' }} />
      <Stack.Screen name="announcements/[id]" options={{ title: 'Announcement' }} />
      <Stack.Screen name="events/index" options={{ title: 'Events' }} />
      <Stack.Screen name="events/[id]" options={{ title: 'Event' }} />
      <Stack.Screen name="documents/index" options={{ title: 'Documents' }} />
      <Stack.Screen name="documents/[id]" options={{ title: 'Document' }} />
      <Stack.Screen name="polls/index" options={{ title: 'Polls' }} />
      <Stack.Screen name="polls/[id]" options={{ title: 'Poll' }} />
      <Stack.Screen name="profile/index" options={{ title: 'Profile' }} />
    </Stack>
  );
}
