import { StyleSheet, Text, View } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { colors } from '@/theme';

export function EmptyState({
  icon = 'inbox',
  message,
}: {
  icon?: keyof typeof MaterialIcons.glyphMap;
  message: string;
}) {
  return (
    <View style={styles.container}>
      <MaterialIcons testID="empty-state-icon" name={icon} size={32} color={colors.textFaint} />
      <Text style={styles.message}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 40 },
  message: { color: colors.textMuted, fontSize: 14, textAlign: 'center' },
});
