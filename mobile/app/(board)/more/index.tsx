import { Alert } from 'react-native';
import { router } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { ScreenContainer } from '@/components/ScreenContainer';
import { ListCard } from '@/components/ListCard';
import { ListRow } from '@/components/ListRow';
import { useAuth } from '@/auth/AuthContext';

const MENU: { icon: keyof typeof MaterialIcons.glyphMap; label: string; href: string }[] = [
  { icon: 'campaign', label: 'Announcements', href: '/more/announcements' },
  { icon: 'event', label: 'Events', href: '/more/events' },
  { icon: 'description', label: 'Documents', href: '/more/documents' },
  { icon: 'how-to-vote', label: 'Polls', href: '/more/polls' },
  { icon: 'holiday-village', label: 'Communities', href: '/more/communities' },
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
            icon={item.icon} title={item.label}
            onPress={() => router.push(item.href)}
          />
        ))}
      </ListCard>

      <ListCard>
        <ListRow
          icon="person" title={`${user?.firstName} ${user?.lastName}`}
          subtitle="Profile & Settings"
          onPress={() => router.push('/more/profile')}
        />
        <ListRow icon="logout" title="Log out" onPress={confirmLogout} />
      </ListCard>
    </ScreenContainer>
  );
}
