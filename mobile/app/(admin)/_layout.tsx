import { Tabs } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import type { ColorValue } from 'react-native';
import { colors } from '@/theme';

function TabIcon({ name, color }: { name: keyof typeof MaterialIcons.glyphMap; color: ColorValue }) {
  return <MaterialIcons name={name} size={22} color={color} />;
}

export default function AdminTabsLayout() {
  return (
    <Tabs screenOptions={{ headerShown: false, tabBarActiveTintColor: colors.primary }}>
      <Tabs.Screen name="index" options={{ title: 'Dashboard', tabBarIcon: ({ color }) => <TabIcon name="home" color={color} /> }} />
      <Tabs.Screen name="issues" options={{ title: 'Issues', tabBarIcon: ({ color }) => <TabIcon name="build" color={color} /> }} />
      <Tabs.Screen name="violations" options={{ title: 'Violations', tabBarIcon: ({ color }) => <TabIcon name="warning" color={color} /> }} />
      <Tabs.Screen name="more" options={{ title: 'More', tabBarIcon: ({ color }) => <TabIcon name="menu" color={color} /> }} />
    </Tabs>
  );
}
