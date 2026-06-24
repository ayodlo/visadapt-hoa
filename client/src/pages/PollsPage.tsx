import { useState } from 'react';
import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { apiClient } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { Poll, PollOption, fullName } from '../types';
import { Pagination } from '../components/Pagination';

interface PollsResponse {
  polls: Poll[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
}

function isClosed(poll: Poll) {
  return poll.closesAt ? new Date(poll.closesAt) < new Date() : false;
}

function VoteBar({ option, total, chosen }: { option: PollOption; total: number; chosen: boolean }) {
  const pct = total > 0 ? Math.round((option.voteCount / total) * 100) : 0;
  return (
    <div className={`rounded-lg border px-4 py-3 space-y-1 ${chosen ? 'border-brand-400 bg-brand-50' : 'border-gray-200 bg-gray-50'}`}>
      <div className="flex justify-between text-sm">
        <span className={`font-medium ${chosen ? 'text-brand-700' : 'text-gray-700'}`}>
          {option.text} {chosen && '✓'}
        </span>
        <span className="text-gray-400 text-xs">{pct}% · {option.voteCount}</span>
      </div>
      <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${chosen ? 'bg-brand-500' : 'bg-gray-400'}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

function PollCard({ poll }: { poll: Poll }) {
  const queryClient = useQueryClient();
  const closed = isClosed(poll);
  const hasVoted = poll.myVote !== null;
  const showResults = hasVoted || closed;

  const { mutate: vote, isPending } = useMutation({
    mutationFn: (optionId: string) =>
      apiClient.post(`/api/polls/${poll.id}/vote`, { optionId }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['polls'] }),
  });

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 space-y-4">
      <div className="space-y-1">
        <div className="flex items-start justify-between gap-4">
          <h2 className="font-semibold text-gray-900">{poll.question}</h2>
          {closed ? (
            <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full shrink-0">Closed</span>
          ) : poll.closesAt ? (
            <span className="text-xs text-gray-400 shrink-0">
              Closes {new Date(poll.closesAt).toLocaleDateString()}
            </span>
          ) : null}
        </div>
        {poll.description && (
          <p className="text-sm text-gray-500">{poll.description}</p>
        )}
        <p className="text-xs text-gray-400">
          By {fullName(poll.createdBy)} · {poll.totalVotes} vote{poll.totalVotes !== 1 ? 's' : ''}
        </p>
      </div>

      <div className="space-y-2">
        {showResults
          ? poll.options.map((o) => (
              <VoteBar key={o.id} option={o} total={poll.totalVotes} chosen={o.id === poll.myVote} />
            ))
          : poll.options.map((o) => (
              <button
                key={o.id}
                onClick={() => vote(o.id)}
                disabled={isPending}
                className="w-full text-left rounded-lg border border-gray-200 px-4 py-2.5 text-sm text-gray-700 hover:border-brand-400 hover:bg-brand-50 hover:text-brand-700 transition-colors disabled:opacity-50"
              >
                {o.text}
              </button>
            ))}
      </div>
    </div>
  );
}

export function PollsPage() {
  const { user } = useAuth();
  const canCreate = user?.role === 'ADMIN' || user?.role === 'BOARD_MEMBER';
  const [page, setPage] = useState(1);

  const { data, isLoading, isError } = useQuery({
    queryKey: ['polls', page],
    queryFn: () => apiClient.get<PollsResponse>(`/api/polls?page=${page}&limit=10`),
    placeholderData: keepPreviousData,
  });

  const open = data?.polls.filter((p) => !isClosed(p)) ?? [];
  const closed = data?.polls.filter((p) => isClosed(p)) ?? [];

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Polls & Voting</h1>
        {canCreate && (
          <Link
            to="/polls/new"
            className="bg-brand-600 text-white text-sm font-semibold px-4 py-2 rounded-lg hover:bg-brand-700 transition-colors"
          >
            + New Poll
          </Link>
        )}
      </div>

      {isLoading && <p className="text-sm text-gray-400 text-center py-12">Loading polls…</p>}
      {isError && <p className="text-sm text-red-500 text-center py-12">Failed to load polls.</p>}

      {data && open.length === 0 && closed.length === 0 && (
        <p className="text-sm text-gray-400 text-center py-12">
          No polls yet.{canCreate && ' Create the first one!'}
        </p>
      )}

      {open.length > 0 && (
        <div className="space-y-4">
          {open.map((p) => <PollCard key={p.id} poll={p} />)}
        </div>
      )}

      {closed.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-sm font-medium text-gray-400 uppercase tracking-wide">Closed</h2>
          {closed.map((p) => <PollCard key={p.id} poll={p} />)}
        </div>
      )}

      {data?.pagination && (
        <Pagination pagination={data.pagination} onChange={setPage} />
      )}
    </div>
  );
}
