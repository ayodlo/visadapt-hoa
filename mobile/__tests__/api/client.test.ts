import { apiFetch, setAuthToken, setUnauthorizedHandler, ApiError } from '@/api/client';

function mockFetchOnce(status: number, body: unknown) {
  globalThis.fetch = jest.fn().mockResolvedValue({
    status,
    ok: status >= 200 && status < 300,
    json: async () => body,
  }) as unknown as typeof fetch;
}

describe('apiFetch', () => {
  beforeEach(() => {
    setAuthToken(null);
    setUnauthorizedHandler(null);
  });

  it('sets Content-Type on every request', async () => {
    mockFetchOnce(200, { ok: true });
    await apiFetch('/api/ping');
    const [, init] = (globalThis.fetch as jest.Mock).mock.calls[0];
    expect(new Headers(init.headers).get('Content-Type')).toBe('application/json');
  });

  it('omits the Authorization header when no token is set', async () => {
    mockFetchOnce(200, { ok: true });
    await apiFetch('/api/ping');
    const [, init] = (globalThis.fetch as jest.Mock).mock.calls[0];
    expect(new Headers(init.headers).get('Authorization')).toBeNull();
  });

  it('attaches a Bearer Authorization header once a token is set', async () => {
    setAuthToken('abc123');
    mockFetchOnce(200, { ok: true });
    await apiFetch('/api/ping');
    const [, init] = (globalThis.fetch as jest.Mock).mock.calls[0];
    expect(new Headers(init.headers).get('Authorization')).toBe('Bearer abc123');
  });

  it('returns the parsed JSON body on success', async () => {
    mockFetchOnce(200, { user: { id: '1' } });
    const result = await apiFetch<{ user: { id: string } }>('/api/auth/me');
    expect(result).toEqual({ user: { id: '1' } });
  });

  it('throws ApiError with the server message on a non-ok response', async () => {
    mockFetchOnce(400, { error: 'Bad request' });
    await expect(apiFetch('/api/issues')).rejects.toMatchObject({ message: 'Bad request', status: 400 });
  });

  it('falls back to a default message when the error body has none', async () => {
    mockFetchOnce(500, {});
    await expect(apiFetch('/api/issues')).rejects.toMatchObject({ message: 'Request failed', status: 500 });
  });

  it('calls the unauthorized handler and throws a 401 ApiError on a 401 response', async () => {
    const handler = jest.fn();
    setUnauthorizedHandler(handler);
    mockFetchOnce(401, { error: 'Unauthorized' });

    let caught: unknown;
    try {
      await apiFetch('/api/auth/me');
    } catch (e) {
      caught = e;
    }
    expect(caught).toBeInstanceOf(ApiError);
    expect((caught as ApiError).status).toBe(401);
    expect(handler).toHaveBeenCalledTimes(1);
  });
});
