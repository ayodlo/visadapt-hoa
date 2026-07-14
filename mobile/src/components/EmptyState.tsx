import { StyleSheet, Text, View } from 'react-native';
import { colors } from '@/theme';

export function EmptyState({ icon = '📭', message }: { icon?: string; message: string }) {
  return (
    <View style={styles.container}>
      <Text style={styles.icon}>{icon}</Text>
      <Text style={styles.message}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 40 },
  icon: { fontSize: 32 },
  message: { color: colors.textMuted, fontSize: 14, textAlign: 'center' },
});
