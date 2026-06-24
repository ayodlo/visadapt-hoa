import { describe, it, expect } from 'vitest';
import { cn } from './cn';

describe('cn', () => {
  it('joins class strings', () => {
    expect(cn('a', 'b')).toBe('a b');
  });

  it('filters falsy values', () => {
    expect(cn('a', false, undefined, null, 'b')).toBe('a b');
  });
});
