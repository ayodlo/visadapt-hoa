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
  // RESIDENT's fixed home community. Null for ADMIN/BOARD_MEMBER (who use
  // CommunityAssignment + an active-community selection instead) and for
  // SUPER_ADMIN (unrestricted). See src/api/community.ts.
  communityId: string | null;
}

export function isAdmin(role: UserRole): boolean {
  return role === 'ADMIN' || role === 'SUPER_ADMIN';
}

export function isStaff(role: UserRole): boolean {
  return role !== 'RESIDENT';
}
