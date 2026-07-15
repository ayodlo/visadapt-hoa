import { useEffect } from 'react';
import { Stack, useRouter } from 'expo-router';
import * as Notifications from 'expo-notifications';
import { AuthProvider, useAuth } from '@/auth/AuthContext';
import { isAdmin } from '@/types/auth';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

function resolveNotificationRoute(type: string, id: string, role: string): string | null {
  switch (type) {
    case 'announcement':
      return `/more/announcements/${id}`;
    case 'issue':
      return `/issues/${id}`;
    case 'violation':
      return role === 'RESIDENT' ? `/more/violations/${id}` : `/violations/${id}`;
    case 'architectural-request':
      return `/more/architectural-requests/${id}`;
    default:
      return null;
  }
}

export default function RootLayout() {
  return (
    <AuthProvider>
      <RootNavigator />
    </AuthProvider>
  );
}

function RootNavigator() {
  const { user, isLoading, activeCommunityId } = useAuth();
  const router = useRouter();

  useEffect(() => {
    const sub = Notifications.addNotificationResponseReceivedListener((response) => {
      if (!user) return;
      const data = response.notification.request.content.data as { type?: string; id?: string };
      if (!data?.type || !data.id) return;
      const path = resolveNotificationRoute(data.type, data.id, user.role);
      if (path) router.push(path as never);
    });
    return () => sub.remove();
  }, [user, router]);

  // Session restore from secure storage is still in flight — render nothing
  // rather than briefly flashing the sign-in screen for an already-logged-in user.
  if (isLoading) return null;

  return (
    // Keyed by the active community so switching forces a full remount of
    // every screen — most screens fetch their own data once via useApi on
    // mount, so without this they'd keep showing the previous community's
    // data after a switch (the same class of bug fixed on web by using a
    // full page reload instead of router.refresh()).
    <Stack key={activeCommunityId ?? 'no-community'} screenOptions={{ headerShown: false }}>
      <Stack.Protected guard={!user}>
        <Stack.Screen name="(auth)" />
      </Stack.Protected>

      <Stack.Protected guard={!!user && user.role === 'RESIDENT'}>
        <Stack.Screen name="(resident)" />
      </Stack.Protected>

      <Stack.Protected guard={!!user && user.role === 'BOARD_MEMBER'}>
        <Stack.Screen name="(board)" />
      </Stack.Protected>

      <Stack.Protected guard={!!user && isAdmin(user.role)}>
        <Stack.Screen name="(admin)" />
      </Stack.Protected>
    </Stack>
  );
}
