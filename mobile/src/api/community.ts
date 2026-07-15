import { apiFetch } from './client';
import type { Community, CommunityWithCounts, MyCommunitiesResponse } from '@/types/community';

export function getMyCommunities() {
  return apiFetch<MyCommunitiesResponse>('/api/community/mine');
}

// SUPER_ADMIN only.
export function listAllCommunities() {
  return apiFetch<CommunityWithCounts[]>('/api/admin/communities');
}

// SUPER_ADMIN only.
export function createCommunity(name: string) {
  return apiFetch<Community>('/api/admin/communities', {
    method: 'POST',
    body: JSON.stringify({ name }),
  });
}

// SUPER_ADMIN only — replaces the full community-assignment set for an ADMIN/BOARD_MEMBER user.
export function updateUserCommunities(userId: string, communityIds: string[]) {
  return apiFetch<{ assignments: { communityId: string; community: { name: string } }[] }>(
    `/api/users/${userId}/communities`,
    { method: 'PUT', body: JSON.stringify({ communityIds }) }
  );
}
