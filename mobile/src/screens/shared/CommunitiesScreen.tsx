import { useCallback, useState } from 'react';
import { StyleSheet, Text } from 'react-native';
import { ScreenContainer } from '@/components/ScreenContainer';
import { Card } from '@/components/Card';
import { ListCard } from '@/components/ListCard';
import { ListRow } from '@/components/ListRow';
import { FormField } from '@/components/FormField';
import { Button } from '@/components/Button';
import { LoadingView } from '@/components/LoadingView';
import { ErrorView } from '@/components/ErrorView';
import { useApi } from '@/hooks/useApi';
import { useAuth } from '@/auth/AuthContext';
import { getMyCommunities, createCommunity } from '@/api/community';
import { ApiError } from '@/api/client';
import { colors } from '@/theme';

export function CommunitiesScreen() {
  const { user, activeCommunityId, switchCommunity } = useAuth();
  const { data, loading, error, refreshing, refresh, reload } = useApi(useCallback(() => getMyCommunities(), []));
  const [switching, setSwitching] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState('');
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  async function handleSelect(communityId: string) {
    if (communityId === activeCommunityId) return;
    setSwitching(communityId);
    await switchCommunity(communityId);
    setSwitching(null);
  }

  async function handleCreate() {
    setCreating(true);
    setCreateError(null);
    try {
      await createCommunity(name.trim());
      setName('');
      setShowForm(false);
      await reload();
    } catch (e) {
      setCreateError(e instanceof ApiError ? e.message : 'Could not create community.');
    } finally {
      setCreating(false);
    }
  }

  if (loading) return <LoadingView />;
  if (error || !data) return <ErrorView message={error ?? undefined} onRetry={refresh} />;

  return (
    <ScreenContainer onRefresh={refresh} refreshing={refreshing}>
      <ListCard>
        {data.communities.map((c) => (
          <ListRow
            key={c.id}
            title={c.name}
            subtitle={c.id === activeCommunityId ? 'Active' : undefined}
            right={switching === c.id ? <Text style={styles.pending}>Switching…</Text> : c.id === activeCommunityId ? <Text style={styles.check}>✓</Text> : undefined}
            onPress={() => handleSelect(c.id)}
          />
        ))}
      </ListCard>

      {user?.role === 'SUPER_ADMIN' && !showForm && (
        <ListCard>
          <ListRow title="+ Add Community" onPress={() => setShowForm(true)} />
        </ListCard>
      )}

      {user?.role === 'SUPER_ADMIN' && showForm && (
        <Card style={styles.formCard}>
          <FormField label="Community name" value={name} onChangeText={setName} />
          {createError && <Text style={styles.error}>{createError}</Text>}
          <Button label="Create Community" onPress={handleCreate} loading={creating} disabled={!name.trim()} />
        </Card>
      )}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  check: { color: colors.primary, fontSize: 16, fontWeight: '700' },
  pending: { color: colors.textMuted, fontSize: 13 },
  formCard: { gap: 10 },
  error: { color: colors.danger, fontSize: 13 },
});
