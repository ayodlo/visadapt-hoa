import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors } from '@/theme';

interface Props<T extends string> {
  options: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
}

// Lightweight stand-in for a native <select> — React Native has none built
// in, and we're avoiding a new picker dependency for a handful of enum inputs.
export function ChipSelect<T extends string>({ options, value, onChange }: Props<T>) {
  return (
    <View style={styles.row}>
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <Pressable
            key={opt.value}
            onPress={() => onChange(opt.value)}
            style={[styles.chip, active && styles.chipActive]}
          >
            <Text style={[styles.label, active && styles.labelActive]}>{opt.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
  },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  label: { fontSize: 13, color: colors.text, fontWeight: '500' },
  labelActive: { color: '#fff' },
});
