import { Tabs } from 'expo-router';
import { Text } from 'react-native';
import { colors } from '@/theme';

function TabIcon({ symbol }: { symbol: string }) {
  return <Text style={{ fontSize: 20 }}>{symbol}</Text>;
}

export default function BoardTabsLayout() {
  return (
    <Tabs screenOptions={{ headerShown: false, tabBarActiveTintColor: colors.primary }}>
      <Tabs.Screen name="index" options={{ title: 'Dashboard', tabBarIcon: () => <TabIcon symbol="🏠" /> }} />
      <Tabs.Screen name="requests" options={{ title: 'Requests', tabBarIcon: () => <TabIcon symbol="🏗️" /> }} />
      <Tabs.Screen name="violations" options={{ title: 'Violations', tabBarIcon: () => <TabIcon symbol="⚠️" /> }} />
      <Tabs.Screen name="more" options={{ title: 'More', tabBarIcon: () => <TabIcon symbol="☰" /> }} />
    </Tabs>
  );
}
