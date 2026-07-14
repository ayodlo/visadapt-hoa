import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors } from '@/theme';

export function ErrorView({ message, onRetry }: { message?: string; onRetry?: () => void }) {
  return (
    <View style={styles.container}>
      <Text style={styles.text}>{message ?? 'Something went wrong.'}</Text>
      {onRetry && (
        <Pressable onPress={onRetry} style={styles.button}>
          <Text style={styles.buttonText}>Try again</Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 24, backgroundColor: colors.bg },
  text: { color: colors.danger, fontSize: 15, textAlign: 'center' },
  button: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8, backgroundColor: colors.primary },
  buttonText: { color: colors.primaryText, fontWeight: '600' },
});
