interface Props {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
}

export function PageHeader({ title, subtitle, action }: Props) {
  return (
    <div className="flex items-start justify-between flex-wrap mb-6 gap-4">
      <div className="min-w-0">
        <h1 className="text-2xl font-bold text-gray-900 break-words">{title}</h1>
        {subtitle && <p className="text-gray-500 mt-0.5 text-sm break-words">{subtitle}</p>}
      </div>
      {action && <div className="flex-shrink-0">{action}</div>}
    </div>
  );
}
