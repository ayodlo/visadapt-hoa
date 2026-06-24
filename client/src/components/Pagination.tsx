interface PaginationMeta {
  page: number;
  totalPages: number;
  total: number;
  limit: number;
}

interface Props {
  pagination: PaginationMeta;
  onChange: (page: number) => void;
}

export function Pagination({ pagination, onChange }: Props) {
  const { page, totalPages, total, limit } = pagination;
  if (totalPages <= 1) return null;

  const from = (page - 1) * limit + 1;
  const to = Math.min(page * limit, total);

  return (
    <div className="flex items-center justify-between pt-2">
      <p className="text-xs text-gray-400">
        {from}–{to} of {total}
      </p>
      <div className="flex items-center gap-1">
        <button
          onClick={() => onChange(page - 1)}
          disabled={page <= 1}
          className="px-3 py-1.5 text-sm rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          Previous
        </button>
        <span className="px-3 py-1.5 text-sm text-gray-500">
          {page} / {totalPages}
        </span>
        <button
          onClick={() => onChange(page + 1)}
          disabled={page >= totalPages}
          className="px-3 py-1.5 text-sm rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          Next
        </button>
      </div>
    </div>
  );
}
