import { describe, it, expect, vi } from 'vitest';
import { getHealth } from './healthController';
import type { Request, Response } from 'express';

describe('getHealth', () => {
  it('responds with status ok', () => {
    const req = {} as Request;
    const json = vi.fn();
    const res = { json } as unknown as Response;

    getHealth(req, res);

    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'ok', service: 'communityhq-api' })
    );
  });
});
