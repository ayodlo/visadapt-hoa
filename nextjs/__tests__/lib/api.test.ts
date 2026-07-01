import { describe, it, expect, vi } from 'vitest';

vi.mock('next/server', () => ({
  NextResponse: {
    json: (data: unknown, init?: { status?: number }) => ({
      _body: data,
      status: init?.status ?? 200,
    }),
  },
}));

const { ok, err, unauthorized, forbidden, notFound } = await import('@/lib/api');

type MockRes = { _body: unknown; status: number };
function body(res: unknown) { return (res as unknown as MockRes)._body; }
function status(res: unknown) { return (res as unknown as MockRes).status; }

describe('ok', () => {
  it('returns 200 by default', () => {
    const res = ok({ id: 1 });
    expect(status(res)).toBe(200);
    expect(body(res)).toEqual({ id: 1 });
  });

  it('accepts a custom status', () => {
    const res = ok({ id: 1 }, 201);
    expect(status(res)).toBe(201);
  });
});

describe('err', () => {
  it('returns 400 by default', () => {
    const res = err('Bad input');
    expect(status(res)).toBe(400);
    expect(body(res)).toEqual({ error: 'Bad input' });
  });

  it('accepts a custom status', () => {
    const res = err('Not found', 404);
    expect(status(res)).toBe(404);
  });
});

describe('unauthorized', () => {
  it('returns 401 with Unauthorized message', () => {
    const res = unauthorized();
    expect(status(res)).toBe(401);
    expect(body(res)).toEqual({ error: 'Unauthorized' });
  });
});

describe('forbidden', () => {
  it('returns 403 with Forbidden message', () => {
    const res = forbidden();
    expect(status(res)).toBe(403);
    expect(body(res)).toEqual({ error: 'Forbidden' });
  });
});

describe('notFound', () => {
  it('returns 404 with default message', () => {
    const res = notFound();
    expect(status(res)).toBe(404);
    expect(body(res)).toEqual({ error: 'Resource not found' });
  });

  it('returns 404 with a custom resource name', () => {
    const res = notFound('Announcement');
    expect(body(res)).toEqual({ error: 'Announcement not found' });
  });
});
