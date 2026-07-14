import { Pressable, StyleSheet, View, type ViewProps } from 'react-native';
import { colors } from '@/theme';

interface Props extends ViewProps {
  onPress?: () => void;
}

export function Card({ children, style, onPress, ...rest }: Props) {
  if (onPress) {
    return (
      <Pressable onPress={onPress} style={({ pressed }) => [styles.card, pressed && styles.pressed, style as object]} {...rest}>
        {children}
      </Pressable>
    );
  }
  return (
    <View style={[styles.card, style as object]} {...rest}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: 16,
  },
  pressed: { opacity: 0.7 },
});
