import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useAuth } from '@/auth/AuthContext';

// Phase 1 stand-in for the real role dashboards built in Phases 2-4 — proves
// the auth/navigation plumbing works end to end (login, role-based routing,
// persisted session, logout).
export function DashboardPlaceholder({ title }: { title: string }) {
  const { user, logout } = useAuth();

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{title}</Text>
      {user && (
        <Text style={styles.subtitle}>
          Welcome, {user.firstName} {user.lastName} ({user.role})
        </Text>
      )}
      <Pressable style={styles.button} onPress={() => logout()}>
        <Text style={styles.buttonText}>Log out</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12, padding: 24 },
  title: { fontSize: 22, fontWeight: '700' },
  subtitle: { fontSize: 15, color: '#4b5563' },
  button: { marginTop: 16, paddingHorizontal: 20, paddingVertical: 10, borderRadius: 8, backgroundColor: '#ef4444' },
  buttonText: { color: '#fff', fontWeight: '600' },
});
