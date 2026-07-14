import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { ScreenContainer } from '@/components/ScreenContainer';
import { Card } from '@/components/Card';
import { LoadingView } from '@/components/LoadingView';
import { ErrorView } from '@/components/ErrorView';
import { useApi } from '@/hooks/useApi';
import { listPolls, voteInPoll } from '@/api/polls';
import { ApiError } from '@/api/client';
import { colors } from '@/theme';
import { formatDateTime } from '@/utils/format';

export function PollDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data, loading, error, reload } = useApi(listPolls);
  const [votedOptionId, setVotedOptionId] = useState<string | null>(null);
  const [alreadyVoted, setAlreadyVoted] = useState(false);
  const [voting, setVoting] = useState(false);
  const [voteError, setVoteError] = useState<string | null>(null);

  if (loading) return <LoadingView />;
  if (error || !data) return <ErrorView message={error ?? undefined} onRetry={reload} />;

  const poll = data.find((p) => p.id === id);
  if (!poll) return <ErrorView message="Poll not found." />;

  const closed = poll.closesAt ? new Date(poll.closesAt) < new Date() : false;
  const hasVoted = alreadyVoted || votedOptionId !== null;
  const totalVotes = poll._count.votes;

  async function handleVote(optionId: string) {
    setVoting(true);
    setVoteError(null);
    try {
      await voteInPoll(poll!.id, optionId);
      setVotedOptionId(optionId);
      await reload();
    } catch (e) {
      if (e instanceof ApiError && e.status === 409) {
        setAlreadyVoted(true);
      } else {
        setVoteError(e instanceof ApiError ? e.message : 'Failed to vote.');
      }
    } finally {
      setVoting(false);
    }
  }

  return (
    <ScreenContainer>
      <Card style={styles.headerCard}>
        <Text style={styles.question}>{poll.question}</Text>
        {poll.description && <Text style={styles.description}>{poll.description}</Text>}
        <Text style={styles.meta}>
          {totalVotes} {totalVotes === 1 ? 'vote' : 'votes'}
          {poll.closesAt && ` · ${closed ? 'closed' : 'closes'} ${formatDateTime(poll.closesAt)}`}
        </Text>
      </Card>

      {voteError && <Text style={styles.error}>{voteError}</Text>}
      {alreadyVoted && <Text style={styles.info}>You have already voted in this poll.</Text>}
      {closed && !hasVoted && !alreadyVoted && <Text style={styles.info}>This poll is closed.</Text>}

      {poll.options.map((opt) => {
        const pct = totalVotes > 0 ? Math.round((opt._count.votes / totalVotes) * 100) : 0;
        const isMine = votedOptionId === opt.id;
        const disabled = voting || hasVoted || closed;
        return (
          <Card
            key={opt.id}
            onPress={disabled ? undefined : () => handleVote(opt.id)}
            style={[styles.optionCard, isMine && styles.optionCardActive]}
          >
            <View style={styles.optionRow}>
              <Text style={styles.optionText}>{opt.text}</Text>
              {(hasVoted || closed) && <Text style={styles.optionPct}>{pct}%</Text>}
            </View>
            {(hasVoted || closed) && (
              <View style={styles.barTrack}>
                <View style={[styles.barFill, { width: `${pct}%` }]} />
              </View>
            )}
          </Card>
        );
      })}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  headerCard: { gap: 6 },
  question: { fontSize: 18, fontWeight: '700', color: colors.text },
  description: { fontSize: 14, color: colors.text },
  meta: { fontSize: 13, color: colors.textMuted },
  error: { color: colors.danger, fontSize: 13 },
  info: { color: colors.textMuted, fontSize: 13, fontStyle: 'italic' },
  optionCard: { gap: 6 },
  optionCardActive: { borderColor: colors.primary, borderWidth: 2 },
  optionRow: { flexDirection: 'row', justifyContent: 'space-between' },
  optionText: { fontSize: 15, color: colors.text, fontWeight: '500', flex: 1 },
  optionPct: { fontSize: 13, color: colors.textMuted, fontWeight: '600' },
  barTrack: { height: 6, borderRadius: 3, backgroundColor: colors.neutralBg, overflow: 'hidden' },
  barFill: { height: 6, backgroundColor: colors.primary },
});
