import { ActivityIndicator, Pressable, StyleSheet, Text } from 'react-native';
import { colors } from '@/theme';

interface Props {
  label: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
  variant?: 'primary' | 'danger' | 'secondary';
}

export function Button({ label, onPress, loading, disabled, variant = 'primary' }: Props) {
  const isDisabled = disabled || loading;
  return (
    <Pressable
      onPress={onPress}
      disabled={isDisabled}
      style={[styles.base, styles[variant], isDisabled && styles.disabled]}
    >
      {loading ? (
        <ActivityIndicator color={variant === 'secondary' ? colors.primary : '#fff'} />
      ) : (
        <Text style={[styles.label, variant === 'secondary' && styles.secondaryLabel]}>{label}</Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: { borderRadius: 8, paddingVertical: 13, alignItems: 'center', justifyContent: 'center' },
  primary: { backgroundColor: colors.primary },
  danger: { backgroundColor: colors.danger },
  secondary: { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border },
  disabled: { opacity: 0.5 },
  label: { color: '#fff', fontSize: 15, fontWeight: '600' },
  secondaryLabel: { color: colors.text },
});
