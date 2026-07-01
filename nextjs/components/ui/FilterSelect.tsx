'use client';

export interface FilterOption {
  label: string;
  value: string;
}

interface Props {
  label?: string;
  options: FilterOption[];
  value: string;
  onChange: (value: string) => void;
  className?: string;
  id?: string;
}

export function FilterSelect({
  label,
  options,
  value,
  onChange,
  className = '',
  id,
}: Props) {
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      {label && (
        <label htmlFor={id} className="text-sm text-gray-500 whitespace-nowrap">
          {label}
        </label>
      )}
      <select
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="text-sm border border-gray-300 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}
