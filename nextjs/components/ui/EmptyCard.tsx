interface Props {
  message: string;
}

/**
 * Standard "no data yet" state for a dashboard card: white card, light gray
 * centered text. Matches the Recent Announcements empty state so every empty
 * dashboard section reads the same.
 */
export function EmptyCard({ message }: Props) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl">
      <p className="px-4 py-6 text-sm text-gray-400 text-center">{message}</p>
    </div>
  );
}
