const DEFAULT_LIMIT = 10;
const MAX_LIMIT = 50;

export function paginate(query: Record<string, unknown>) {
  const rawPage = parseInt(String(query.page ?? 1), 10);
  const rawLimit = parseInt(String(query.limit ?? DEFAULT_LIMIT), 10);
  const page = Math.max(1, isNaN(rawPage) ? 1 : rawPage);
  const limit = Math.min(MAX_LIMIT, Math.max(1, isNaN(rawLimit) ? DEFAULT_LIMIT : rawLimit));
  return { skip: (page - 1) * limit, take: limit, page, limit };
}

export function paginationMeta(total: number, page: number, limit: number) {
  return { page, limit, total, totalPages: Math.ceil(total / limit) };
}
