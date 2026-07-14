import { RefreshControl, ScrollView, StyleSheet, View, type ScrollViewProps } from 'react-native';
import { colors } from '@/theme';

interface Props extends ScrollViewProps {
  scroll?: boolean;
  onRefresh?: () => void;
  refreshing?: boolean;
}

export function ScreenContainer({ children, scroll = true, onRefresh, refreshing, style, ...rest }: Props) {
  if (!scroll) {
    return <View style={[styles.container, style as object]}>{children}</View>;
  }
  return (
    <ScrollView
      style={styles.flex}
      contentContainerStyle={[styles.container, style as object]}
      refreshControl={onRefresh ? <RefreshControl refreshing={!!refreshing} onRefresh={onRefresh} /> : undefined}
      {...rest}
    >
      {children}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.bg },
  container: { padding: 16, gap: 12, backgroundColor: colors.bg },
});
