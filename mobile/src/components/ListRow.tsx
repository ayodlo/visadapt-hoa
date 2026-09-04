import { Pressable, StyleSheet, Text, View } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { colors } from '@/theme';

interface Props {
  title: string;
  /** Optional leading icon; rows without one keep their original layout. */
  icon?: keyof typeof MaterialIcons.glyphMap;
  subtitle?: string;
  right?: React.ReactNode;
  onPress?: () => void;
}

export function ListRow({ title, icon, subtitle, right, onPress }: Props) {
  return (
    <Pressable onPress={onPress} disabled={!onPress} style={({ pressed }) => [styles.row, pressed && onPress && styles.pressed]}>
      {icon && <MaterialIcons name={icon} size={20} color={colors.textMuted} />}
      <View style={styles.textCol}>
        <Text style={styles.title} numberOfLines={1}>
          {title}
        </Text>
        {subtitle && (
          <Text style={styles.subtitle} numberOfLines={1}>
            {subtitle}
          </Text>
        )}
      </View>
      {right && <View style={styles.right}>{right}</View>}
      {onPress && <Text style={styles.chevron}>›</Text>}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: colors.card,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
    gap: 8,
  },
  pressed: { backgroundColor: colors.bg },
  textCol: { flex: 1, gap: 2 },
  title: { fontSize: 15, fontWeight: '600', color: colors.text },
  subtitle: { fontSize: 13, color: colors.textMuted },
  right: { marginLeft: 'auto' },
  chevron: { fontSize: 20, color: colors.textFaint, marginLeft: 4 },
});
