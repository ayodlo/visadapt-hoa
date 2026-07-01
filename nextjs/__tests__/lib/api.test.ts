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

describe('ok', () => {
  it('returns 200 by default', () => {
    const res = ok({ id: 1 });
    expect(res.status).toBe(200);
    expect((res as { _body: unknown })._body).toEqual({ id: 1 });
  });

  it('accepts a custom status', () => {
    const res = ok({ id: 1 }, 201);
    expect(res.status).toBe(201);
  });
});

describe('err', () => {
  it('returns 400 by default', () => {
    const res = err('Bad input');
    expect(res.status).toBe(400);
    expect((res as { _body: unknown })._body).toEqual({ error: 'Bad input' });
  });

  it('accepts a custom status', () => {
    const res = err('Not found', 404);
    expect(res.status).toBe(404);
  });
});

describe('unauthorized', () => {
  it('returns 401 with Unauthorized message', () => {
    const res = unauthorized();
    expect(res.status).toBe(401);
    expect((res as { _body: unknown })._body).toEqual({ error: 'Unauthorized' });
  });
});

describe('forbidden', () => {
  it('returns 403 with Forbidden message', () => {
    const res = forbidden();
    expect(res.status).toBe(403);
    expect((res as { _body: unknown })._body).toEqual({ error: 'Forbidden' });
  });
});

describe('notFound', () => {
  it('returns 404 with default message', () => {
    const res = notFound();
    expect(res.status).toBe(404);
    expect((res as { _body: unknown })._body).toEqual({ error: 'Resource not found' });
  });

  it('returns 404 with a custom resource name', () => {
    const res = notFound('Announcement');
    expect((res as { _body: unknown })._body).toEqual({ error: 'Announcement not found' });
  });
});
