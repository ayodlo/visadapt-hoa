import { Inbox } from 'lucide-react';

interface Props {
  /** Accepts a node so callers can pass a lucide icon; strings still render. */
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
}

export function EmptyState({ icon = <Inbox className="w-10 h-10 text-gray-400" />, title, description, action }: Props) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center px-4">
      <span className="text-4xl mb-4" aria-hidden="true">{icon}</span>
      <h3 className="text-base font-semibold text-gray-900 mb-1">{title}</h3>
      {description && (
        <p className="text-sm text-gray-500 max-w-xs">{description}</p>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
