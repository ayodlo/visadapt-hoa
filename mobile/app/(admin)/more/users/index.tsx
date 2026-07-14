import { Pressable, StyleSheet, Text } from 'react-native';
import { router, Stack } from 'expo-router';
import { ScreenContainer } from '@/components/ScreenContainer';
import { ListCard } from '@/components/ListCard';
import { ListRow } from '@/components/ListRow';
import { LoadingView } from '@/components/LoadingView';
import { ErrorView } from '@/components/ErrorView';
import { StatusBadge } from '@/components/StatusBadge';
import { useApi } from '@/hooks/useApi';
import { listUsers } from '@/api/admin';
import { colors } from '@/theme';
import { formatDate } from '@/utils/format';

export default function UsersList() {
  const { data, loading, error, refreshing, refresh } = useApi(listUsers);

  return (
    <>
      <Stack.Screen
        options={{
          headerRight: () => (
            <Pressable onPress={() => router.push('/more/users/new')} hitSlop={12}>
              <Text style={styles.addButton}>+ New</Text>
            </Pressable>
          ),
        }}
      />
      {loading ? (
        <LoadingView />
      ) : error || !data ? (
        <ErrorView message={error ?? undefined} onRetry={refresh} />
      ) : (
        <ScreenContainer onRefresh={refresh} refreshing={refreshing}>
          <ListCard>
            {data.map((u) => (
              <ListRow
                key={u.id}
                title={`${u.firstName} ${u.lastName}`}
                subtitle={`${u.email} · ${formatDate(u.createdAt)}`}
                right={<StatusBadge label={u.role} tone={u.role === 'RESIDENT' ? 'default' : 'info'} />}
                onPress={() => router.push(`/more/users/${u.id}`)}
              />
            ))}
          </ListCard>
        </ScreenContainer>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  addButton: { color: colors.primary, fontSize: 15, fontWeight: '600' },
});
