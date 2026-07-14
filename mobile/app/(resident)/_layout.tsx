import { Tabs } from 'expo-router';
import { Text } from 'react-native';
import { colors } from '@/theme';

function TabIcon({ symbol }: { symbol: string }) {
  return <Text style={{ fontSize: 20 }}>{symbol}</Text>;
}

export default function ResidentTabsLayout() {
  return (
    <Tabs screenOptions={{ headerShown: false, tabBarActiveTintColor: colors.primary }}>
      <Tabs.Screen name="index" options={{ title: 'Dashboard', tabBarIcon: () => <TabIcon symbol="🏠" /> }} />
      <Tabs.Screen name="issues" options={{ title: 'Issues', tabBarIcon: () => <TabIcon symbol="🔨" /> }} />
      <Tabs.Screen name="payments" options={{ title: 'Payments', tabBarIcon: () => <TabIcon symbol="💰" /> }} />
      <Tabs.Screen name="more" options={{ title: 'More', tabBarIcon: () => <TabIcon symbol="☰" /> }} />
    </Tabs>
  );
}
