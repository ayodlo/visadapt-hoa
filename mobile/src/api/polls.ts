import { apiFetch } from './client';
import type { Poll, PollVote } from '@/types/polls';

export function listPolls() {
  return apiFetch<Poll[]>('/api/polls');
}

export function voteInPoll(pollId: string, optionId: string) {
  return apiFetch<PollVote>(`/api/polls/${pollId}/vote`, { method: 'POST', body: JSON.stringify({ optionId }) });
}
