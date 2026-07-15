import { cookies, headers } from 'next/headers';
import { prisma } from './prisma';
import type { SessionUser } from './auth';

const ACTIVE_COMMUNITY_COOKIE = 'active_community';
const ACTIVE_COMMUNITY_HEADER = 'x-active-community';

// RESIDENT belongs to exactly one community (SessionUser.communityId, fixed
// at login). ADMIN and BOARD_MEMBER can be assigned to several
// (CommunityAssignment, managed by SUPER_ADMIN) and switch between them.
// SUPER_ADMIN is unrestricted — every community is "accessible."
export async function listAccessibleCommunities(session: SessionUser) {
  if (session.role === 'SUPER_ADMIN') {
    return prisma.community.findMany({ orderBy: { name: 'asc' } });
  }
  if (session.role === 'RESIDENT') {
    if (!session.communityId) return [];
    return prisma.community.findMany({ where: { id: session.communityId } });
  }
  const assignments = await prisma.communityAssignment.findMany({
    where: { userId: session.id },
    include: { community: true },
    orderBy: { community: { name: 'asc' } },
  });
  return assignments.map((a) => a.community);
}

export async function canAccessCommunity(session: SessionUser, communityId: string): Promise<boolean> {
  if (session.role === 'SUPER_ADMIN') {
    return !!(await prisma.community.findUnique({ where: { id: communityId }, select: { id: true } }));
  }
  if (session.role === 'RESIDENT') {
    return session.communityId === communityId;
  }
  return !!(await prisma.communityAssignment.findUnique({
    where: { userId_communityId: { userId: session.id, communityId } },
    select: { id: true },
  }));
}

// Resolves which community the current request operates within. RESIDENT
// always gets their fixed community with no extra query. ADMIN/BOARD_MEMBER/
// SUPER_ADMIN read the `active_community` cookie (set by the web switcher),
// re-validating it on every call since assignments can change between
// requests, and fall back to the first accessible community otherwise. The
// mobile app authenticates with a Bearer token and never sends cookies, so
// it sends its selection via the `X-Active-Community` header instead — the
// cookie takes precedence when both are present (it never should be).
export async function getActiveCommunityId(session: SessionUser): Promise<string | null> {
  if (session.role === 'RESIDENT') return session.communityId;

  const [cookieStore, headerStore] = await Promise.all([cookies(), headers()]);
  const selected =
    cookieStore.get(ACTIVE_COMMUNITY_COOKIE)?.value ?? headerStore.get(ACTIVE_COMMUNITY_HEADER) ?? null;
  if (selected && (await canAccessCommunity(session, selected))) return selected;

  const accessible = await listAccessibleCommunities(session);
  return accessible[0]?.id ?? null;
}

export function setActiveCommunityCookie(communityId: string): Record<string, string> {
  const isProd = process.env.NODE_ENV === 'production';
  const maxAge = 7 * 24 * 60 * 60;
  return {
    'Set-Cookie': `${ACTIVE_COMMUNITY_COOKIE}=${communityId}; HttpOnly; Path=/; Max-Age=${maxAge}; SameSite=Lax${isProd ? '; Secure' : ''}`,
  };
}
