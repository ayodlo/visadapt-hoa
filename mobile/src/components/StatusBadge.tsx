import { StyleSheet, Text, View } from 'react-native';
import { toneColors, type Tone } from '@/theme';
import { titleCase } from '@/utils/format';

export function StatusBadge({ label, tone = 'default' }: { label: string; tone?: Tone }) {
  const { bg, text } = toneColors[tone];
  return (
    <View style={[styles.badge, { backgroundColor: bg }]}>
      <Text style={[styles.text, { color: text }]}>{titleCase(label)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, alignSelf: 'flex-start' },
  text: { fontSize: 12, fontWeight: '600' },
});
