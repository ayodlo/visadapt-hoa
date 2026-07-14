import { StyleSheet, View, type ViewProps } from 'react-native';
import { colors } from '@/theme';

// Rounded/bordered wrapper for a stack of ListRow items (rows supply their
// own bottom borders/padding; this just gives the group rounded corners).
export function ListCard({ children, style, ...rest }: ViewProps) {
  return (
    <View style={[styles.container, style as object]} {...rest}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    overflow: 'hidden',
  },
});
