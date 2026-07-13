export type UserRole = 'SUPER_ADMIN' | 'ADMIN' | 'BOARD_MEMBER' | 'RESIDENT';

// SUPER_ADMIN carries every ADMIN privilege plus user creation.
// SUPER_ADMIN is engineer-only and is never assignable through the app UI/API — see prisma/create-super-admin.ts.
export function isAdmin(role: UserRole): boolean {
  return role === 'ADMIN' || role === 'SUPER_ADMIN';
}

export function isStaff(role: UserRole): boolean {
  return role !== 'RESIDENT';
}
