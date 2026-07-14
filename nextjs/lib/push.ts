import { prisma } from './prisma';

const EXPO_PUSH_ENDPOINT = 'https://exp.host/--/api/v2/push/send';

export type PushNotification = {
  title: string;
  body: string;
  data?: Record<string, unknown>;
};

export type ExpoPushMessage = {
  to: string;
  title: string;
  body: string;
  data?: Record<string, unknown>;
};

export type ExpoPushTicket = {
  status: 'ok' | 'error';
  details?: { error?: string };
};

export function buildPushMessages(tokens: string[], notification: PushNotification): ExpoPushMessage[] {
  return tokens.map((to) => ({
    to,
    title: notification.title,
    body: notification.body,
    ...(notification.data ? { data: notification.data } : {}),
  }));
}

export function parseInvalidTokens(tickets: ExpoPushTicket[], tokens: string[]): string[] {
  return tickets
    .map((ticket, i) => ({ ticket, token: tokens[i] }))
    .filter(({ ticket }) => ticket.status === 'error' && ticket.details?.error === 'DeviceNotRegistered')
    .map(({ token }) => token)
    .filter((token): token is string => Boolean(token));
}

export async function sendPushToUsers(userIds: string[], notification: PushNotification): Promise<void> {
  if (userIds.length === 0) return;

  try {
    const tokenRows = await prisma.pushToken.findMany({
      where: { userId: { in: userIds } },
      select: { token: true },
    });
    if (tokenRows.length === 0) return;

    const tokens = tokenRows.map((t) => t.token);
    const messages = buildPushMessages(tokens, notification);

    const res = await fetch(EXPO_PUSH_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(messages),
    });
    const json = (await res.json().catch(() => null)) as { data?: ExpoPushTicket[] } | null;
    const tickets = json?.data;
    if (!tickets) return;

    const invalidTokens = parseInvalidTokens(tickets, tokens);
    if (invalidTokens.length > 0) {
      await prisma.pushToken.deleteMany({ where: { token: { in: invalidTokens } } });
    }
  } catch {
    // Best-effort — a push failure must never break the caller's response.
  }
}
