import Link from 'next/link';

type Color = 'default' | 'green' | 'red' | 'yellow' | 'blue';

interface Props {
  label: string;
  value: string | number;
  icon?: string;
  href?: string;
  color?: Color;
  subtext?: string;
}

const valueColors: Record<Color, string> = {
  default: 'text-gray-900',
  green: 'text-green-600',
  red: 'text-red-600',
  yellow: 'text-yellow-600',
  blue: 'text-blue-600',
};

export function StatCard({ label, value, icon, href, color = 'default', subtext }: Props) {
  const inner = (
    <div
      className={`bg-white rounded-xl border border-gray-200 p-5 h-full min-w-0 overflow-hidden ${
        href ? 'hover:border-blue-300 hover:shadow-sm transition-all' : ''
      }`}
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        {icon && <span className="text-2xl shrink-0" aria-hidden="true">{icon}</span>}
        <span className={`text-2xl sm:text-3xl font-bold ml-auto min-w-0 break-words text-right ${valueColors[color]}`}>{value}</span>
      </div>
      <p className="text-sm text-gray-500">{label}</p>
      {subtext && <p className="text-xs text-gray-400 mt-1">{subtext}</p>}
    </div>
  );

  return href ? (
    <Link href={href} className="block focus:outline-none focus:ring-2 focus:ring-blue-500 rounded-xl">
      {inner}
    </Link>
  ) : inner;
}
