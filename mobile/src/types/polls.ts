export interface Poll {
  id: string;
  question: string;
  description: string | null;
  closesAt: string | null;
  createdById: string;
  createdAt: string;
  updatedAt: string;
  createdBy: { id: string; firstName: string; lastName: string };
  options: { id: string; pollId: string; text: string; _count: { votes: number } }[];
  _count: { votes: number };
}

export interface PollVote {
  id: string;
  pollId: string;
  optionId: string;
  userId: string;
  createdAt: string;
}
