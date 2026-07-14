// Hand-written mirror of nextjs/lib/auth.ts SessionUser and nextjs/lib/roles.ts
// UserRole. Kept in sync manually for now — see plan notes on deferring a
// shared types package until shape drift actually becomes painful.
export type UserRole = 'SUPER_ADMIN' | 'ADMIN' | 'BOARD_MEMBER' | 'RESIDENT';

export interface SessionUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: UserRole;
}

export function isAdmin(role: UserRole): boolean {
  return role === 'ADMIN' || role === 'SUPER_ADMIN';
}

export function isStaff(role: UserRole): boolean {
  return role !== 'RESIDENT';
}
