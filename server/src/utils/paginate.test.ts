import { describe, it, expect } from 'vitest';
import { paginate, paginationMeta } from './paginate';

describe('paginate', () => {
  it('uses defaults when query is empty', () => {
    const result = paginate({});
    expect(result).toEqual({ page: 1, limit: 10, skip: 0, take: 10 });
  });

  it('computes skip correctly for page 2', () => {
    const result = paginate({ page: '2', limit: '10' });
    expect(result).toEqual({ page: 2, limit: 10, skip: 10, take: 10 });
  });

  it('clamps limit to MAX_LIMIT (50)', () => {
    const result = paginate({ limit: '999' });
    expect(result.limit).toBe(50);
    expect(result.take).toBe(50);
  });

  it('clamps page to minimum 1', () => {
    expect(paginate({ page: '0' }).page).toBe(1);
    expect(paginate({ page: '-5' }).page).toBe(1);
  });

  it('clamps limit to minimum 1', () => {
    expect(paginate({ limit: '0' }).limit).toBe(1);
  });

  it('handles non-numeric values gracefully', () => {
    const result = paginate({ page: 'abc', limit: 'xyz' });
    expect(result.page).toBe(1);
    expect(result.limit).toBe(10);
  });
});

describe('paginationMeta', () => {
  it('computes totalPages correctly', () => {
    expect(paginationMeta(100, 1, 10)).toEqual({ page: 1, limit: 10, total: 100, totalPages: 10 });
    expect(paginationMeta(101, 1, 10)).toEqual({ page: 1, limit: 10, total: 101, totalPages: 11 });
    expect(paginationMeta(0, 1, 10)).toEqual({ page: 1, limit: 10, total: 0, totalPages: 0 });
  });

  it('rounds totalPages up', () => {
    expect(paginationMeta(11, 1, 10).totalPages).toBe(2);
  });
});
