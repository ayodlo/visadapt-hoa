import { describe, it, expect } from 'vitest';
import { buildPushMessages, parseInvalidTokens } from '@/lib/push';

describe('buildPushMessages', () => {
  it('builds one Expo message per token with title/body', () => {
    const messages = buildPushMessages(['token-a', 'token-b'], { title: 'Hi', body: 'There' });
    expect(messages).toEqual([
      { to: 'token-a', title: 'Hi', body: 'There' },
      { to: 'token-b', title: 'Hi', body: 'There' },
    ]);
  });

  it('includes data payload when provided', () => {
    const messages = buildPushMessages(['token-a'], { title: 'Hi', body: 'There', data: { type: 'issue', id: '1' } });
    expect(messages[0].data).toEqual({ type: 'issue', id: '1' });
  });

  it('omits the data field when not provided', () => {
    const messages = buildPushMessages(['token-a'], { title: 'Hi', body: 'There' });
    expect(messages[0]).not.toHaveProperty('data');
  });

  it('returns an empty array for no tokens', () => {
    expect(buildPushMessages([], { title: 'Hi', body: 'There' })).toEqual([]);
  });
});

describe('parseInvalidTokens', () => {
  const tokens = ['token-a', 'token-b', 'token-c'];

  it('extracts tokens whose ticket reports DeviceNotRegistered', () => {
    const tickets = [
      { status: 'ok' as const },
      { status: 'error' as const, details: { error: 'DeviceNotRegistered' } },
      { status: 'ok' as const },
    ];
    expect(parseInvalidTokens(tickets, tokens)).toEqual(['token-b']);
  });

  it('ignores errors that are not DeviceNotRegistered', () => {
    const tickets = [
      { status: 'error' as const, details: { error: 'MessageTooBig' } },
      { status: 'ok' as const },
      { status: 'ok' as const },
    ];
    expect(parseInvalidTokens(tickets, tokens)).toEqual([]);
  });

  it('returns an empty array when everything succeeds', () => {
    const tickets = [{ status: 'ok' as const }, { status: 'ok' as const }, { status: 'ok' as const }];
    expect(parseInvalidTokens(tickets, tokens)).toEqual([]);
  });
});
