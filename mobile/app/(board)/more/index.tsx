import { Alert } from 'react-native';
import { router } from 'expo-router';
import { ScreenContainer } from '@/components/ScreenContainer';
import { ListCard } from '@/components/ListCard';
import { ListRow } from '@/components/ListRow';
import { useAuth } from '@/auth/AuthContext';

const MENU: { icon: string; label: string; href: string }[] = [
  { icon: '📢', label: 'Announcements', href: '/more/announcements' },
  { icon: '📅', label: 'Events', href: '/more/events' },
  { icon: '📄', label: 'Documents', href: '/more/documents' },
  { icon: '🗳️', label: 'Polls', href: '/more/polls' },
  { icon: '🏘️', label: 'Communities', href: '/more/communities' },
];

export default function BoardMoreMenu() {
  const { user, logout } = useAuth();

  function confirmLogout() {
    Alert.alert('Log out', 'Are you sure you want to log out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Log out', style: 'destructive', onPress: () => logout() },
    ]);
  }

  return (
    <ScreenContainer>
      <ListCard>
        {MENU.map((item) => (
          <ListRow
            key={item.href}
            title={`${item.icon}  ${item.label}`}
            onPress={() => router.push(item.href)}
          />
        ))}
      </ListCard>

      <ListCard>
        <ListRow
          title={`👤  ${user?.firstName} ${user?.lastName}`}
          subtitle="Profile & Settings"
          onPress={() => router.push('/more/profile')}
        />
        <ListRow title="🚪  Log out" onPress={confirmLogout} />
      </ListCard>
    </ScreenContainer>
  );
}
