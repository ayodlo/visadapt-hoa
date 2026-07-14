import { Stack } from 'expo-router';
import { AuthProvider, useAuth } from '@/auth/AuthContext';
import { isAdmin } from '@/types/auth';

export default function RootLayout() {
  return (
    <AuthProvider>
      <RootNavigator />
    </AuthProvider>
  );
}

function RootNavigator() {
  const { user, isLoading } = useAuth();

  // Session restore from secure storage is still in flight — render nothing
  // rather than briefly flashing the sign-in screen for an already-logged-in user.
  if (isLoading) return null;

  return (
    <Stack screenOptions={{ headerShown: false }}>
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
