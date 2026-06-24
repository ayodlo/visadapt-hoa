const API_BASE = import.meta.env.VITE_API_URL ?? '';
const TOKEN_KEY = 'chq_token';

type RequestOptions = Omit<RequestInit, 'body'> & {
  body?: unknown;
};

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { body, headers, ...rest } = options;
  const token = localStorage.getItem(TOKEN_KEY);

  const res = await fetch(`${API_BASE}${path}`, {
    ...rest,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(errorData.error ?? `Request failed: ${res.status}`);
  }

  return res.json() as Promise<T>;
}

export const apiClient = {
  get: <T>(path: string, options?: RequestOptions) =>
    request<T>(path, { method: 'GET', ...options }),

  post: <T>(path: string, body: unknown, options?: RequestOptions) =>
    request<T>(path, { method: 'POST', body, ...options }),

  put: <T>(path: string, body: unknown, options?: RequestOptions) =>
    request<T>(path, { method: 'PUT', body, ...options }),

  patch: <T>(path: string, body: unknown, options?: RequestOptions) =>
    request<T>(path, { method: 'PATCH', body, ...options }),

  delete: <T>(path: string, options?: RequestOptions) =>
    request<T>(path, { method: 'DELETE', ...options }),
};
