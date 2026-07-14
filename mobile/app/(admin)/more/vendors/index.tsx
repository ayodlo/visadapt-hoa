import { Pressable, StyleSheet, Text } from 'react-native';
import { router, Stack } from 'expo-router';
import { ScreenContainer } from '@/components/ScreenContainer';
import { ListCard } from '@/components/ListCard';
import { ListRow } from '@/components/ListRow';
import { LoadingView } from '@/components/LoadingView';
import { ErrorView } from '@/components/ErrorView';
import { EmptyState } from '@/components/EmptyState';
import { useApi } from '@/hooks/useApi';
import { listVendorOptions } from '@/api/admin';
import { colors } from '@/theme';

export default function VendorsList() {
  const { data, loading, error, refreshing, refresh } = useApi(listVendorOptions);

  return (
    <>
      <Stack.Screen
        options={{
          headerRight: () => (
            <Pressable onPress={() => router.push('/more/vendors/new')} hitSlop={12}>
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
          {data.vendors.length === 0 ? (
            <EmptyState icon="🧰" message="No vendors yet. Tap + New to add one." />
          ) : (
            <ListCard>
              {data.vendors.map((v) => (
                <ListRow key={v.id} title={v.name} subtitle={v.contactName ?? v.category ?? undefined} />
              ))}
            </ListCard>
          )}
        </ScreenContainer>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  addButton: { color: colors.primary, fontSize: 15, fontWeight: '600' },
});
