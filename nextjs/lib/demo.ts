import type { UserRole } from './roles';

/**
 * The public demo: one community anyone can sign in to from the login page.
 *
 * Client-safe on purpose — the login page imports these constants, so nothing
 * here may pull in Prisma or `next/headers` (same split as lib/roles.ts).
 * The data itself lives in lib/demo-seed.ts.
 *
 * The credentials are public by design: they are printed on the login page.
 * What keeps the demo usable is that these accounts are locked — see
 * isDemoAccount() and the routes that check it — and that the whole community is
 * wiped and reseeded nightly.
 */

export const DEMO_COMMUNITY_ID = 'community_public_demo';
export const DEMO_COMMUNITY_NAME = 'Willow Creek HOA (Demo)';

export const DEMO_PASSWORD = 'try-portal-hoa';

export type DemoAccount = {
  id: string;
  role: Extract<UserRole, 'RESIDENT' | 'BOARD_MEMBER' | 'ADMIN'>;
  label: string;
  email: string;
  firstName: string;
  lastName: string;
};

/** The three logins offered on the login page. Fixed ids so a reset keeps sessions valid. */
export const DEMO_ACCOUNTS: readonly DemoAccount[] = [
  { id: 'demo_user_resident', role: 'RESIDENT', label: 'Resident', email: 'resident@demo.portalhoa.local', firstName: 'Jordan', lastName: 'Ellis' },
  { id: 'demo_user_board', role: 'BOARD_MEMBER', label: 'Board member', email: 'board@demo.portalhoa.local', firstName: 'Priya', lastName: 'Shah' },
  { id: 'demo_user_admin', role: 'ADMIN', label: 'Manager', email: 'manager@demo.portalhoa.local', firstName: 'Alex', lastName: 'Morgan' },
];

const DEMO_ACCOUNT_IDS = new Set(DEMO_ACCOUNTS.map((a) => a.id));

/**
 * True for the shared demo logins. Their password, role and existence cannot be
 * changed through the app — one visitor doing so would lock every later visitor
 * out until the nightly reset.
 */
export function isDemoAccount(userId: string): boolean {
  return DEMO_ACCOUNT_IDS.has(userId);
}

/** Whether the login page offers the demo buttons. Off unless explicitly enabled. */
export function isDemoLoginEnabled(): boolean {
  return process.env.NEXT_PUBLIC_DEMO_LOGIN === '1';
}
