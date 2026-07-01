'use client';

import { useEffect, useState } from 'react';
import { useSession } from '@/context/session';

interface Option { id: string; text: string; _count: { votes: number }; }
interface Poll { id: string; question: string; description?: string; closesAt?: string; options: Option[]; _count: { votes: number }; createdBy: { firstName: string; lastName: string }; }

export default function PollsPage() {
  const { role } = useSession();
  const isAdmin = role === 'ADMIN' || role === 'BOARD_MEMBER';

  const [polls, setPolls] = useState<Poll[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ question: '', description: '', closesAt: '', options: ['', ''] });
  const [voted, setVoted] = useState<Set<string>>(new Set());
  const [submitting, setSubmitting] = useState(false);

  async function load() {
    const res = await fetch('/api/polls');
    if (res.ok) setPolls(await res.json());
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    const payload: Record<string, unknown> = {
      question: form.question,
      options: form.options.filter(Boolean),
    };
    if (form.description) payload.description = form.description;
    if (form.closesAt) payload.closesAt = new Date(form.closesAt).toISOString();

    const res = await fetch('/api/polls', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (res.ok) { setForm({ question: '', description: '', closesAt: '', options: ['', ''] }); setShowForm(false); load(); }
    setSubmitting(false);
  }

  async function handleVote(pollId: string, optionId: string) {
    const res = await fetch(`/api/polls/${pollId}/vote`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ optionId }),
    });
    if (res.ok) { setVoted((v) => new Set([...v, pollId])); load(); }
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this poll?')) return;
    await fetch(`/api/polls/${id}`, { method: 'DELETE' });
    load();
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Polls</h1>
        {isAdmin && (
          <button onClick={() => setShowForm(!showForm)} className="bg-blue-600 text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors">+ New Poll</button>
        )}
      </div>

      {isAdmin && showForm && (
        <form onSubmit={handleCreate} className="bg-white border border-gray-200 rounded-xl p-5 mb-6 space-y-3">
          <input required placeholder="Question" value={form.question} onChange={(e) => setForm((f) => ({ ...f, question: e.target.value }))} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          <textarea placeholder="Description (optional)" rows={2} value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          <div className="space-y-2">
            <label className="text-xs text-gray-500 font-medium">Options</label>
            {form.options.map((opt, i) => (
              <div key={i} className="flex gap-2">
                <input placeholder={`Option ${i + 1}`} value={opt} onChange={(e) => { const opts = [...form.options]; opts[i] = e.target.value; setForm((f) => ({ ...f, options: opts })); }} className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                {form.options.length > 2 && <button type="button" onClick={() => setForm((f) => ({ ...f, options: f.options.filter((_, j) => j !== i) }))} className="text-xs text-red-400 hover:text-red-600">✕</button>}
              </div>
            ))}
            <button type="button" onClick={() => setForm((f) => ({ ...f, options: [...f.options, ''] }))} className="text-xs text-blue-600 hover:underline">+ Add option</button>
          </div>
          <div><label className="text-xs text-gray-500">Closes at (optional)</label><input type="datetime-local" value={form.closesAt} onChange={(e) => setForm((f) => ({ ...f, closesAt: e.target.value }))} className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" /></div>
          <div className="flex gap-2">
            <button type="submit" disabled={submitting} className="bg-blue-600 text-white text-sm px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50">{submitting ? 'Creating…' : 'Create'}</button>
            <button type="button" onClick={() => setShowForm(false)} className="text-sm px-4 py-2 rounded-lg border border-gray-300 hover:bg-gray-50">Cancel</button>
          </div>
        </form>
      )}

      {loading ? <p className="text-gray-500 text-sm">Loading…</p> : polls.length === 0 ? <p className="text-gray-500 text-sm">No polls yet.</p> : (
        <div className="space-y-4">
          {polls.map((poll) => {
            const total = poll._count.votes;
            const hasVoted = voted.has(poll.id);
            const closed = poll.closesAt ? new Date(poll.closesAt) < new Date() : false;
            return (
              <div key={poll.id} className="bg-white border border-gray-200 rounded-xl p-5">
                <div className="flex items-start justify-between gap-4 mb-3">
                  <div>
                    <h3 className="font-semibold text-gray-900">{poll.question}</h3>
                    {poll.description && <p className="text-sm text-gray-500 mt-0.5">{poll.description}</p>}
                    <p className="text-xs text-gray-400 mt-1">{total} vote{total !== 1 ? 's' : ''}{closed ? ' · Closed' : ''}</p>
                  </div>
                  {isAdmin && (
                    <button onClick={() => handleDelete(poll.id)} className="text-xs text-gray-400 hover:text-red-500 flex-shrink-0">Delete</button>
                  )}
                </div>
                <div className="space-y-2">
                  {poll.options.map((opt) => {
                    const pct = total > 0 ? Math.round((opt._count.votes / total) * 100) : 0;
                    return (
                      <button key={opt.id} disabled={hasVoted || closed} onClick={() => handleVote(poll.id, opt.id)}
                        className="w-full text-left relative rounded-lg border border-gray-200 px-3 py-2 text-sm hover:border-blue-400 disabled:cursor-default overflow-hidden transition-colors">
                        <div className="absolute inset-0 bg-blue-50 transition-all" style={{ width: hasVoted || closed ? `${pct}%` : '0%' }} />
                        <span className="relative flex justify-between"><span>{opt.text}</span>{(hasVoted || closed) && <span className="text-gray-500">{pct}%</span>}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
