import { getSession } from '@/lib/auth';
import { listAccessibleCommunities, getActiveCommunityId } from '@/lib/community';
import { ok, unauthorized } from '@/lib/api';

export async function GET() {
  const session = await getSession();
  if (!session) return unauthorized();

  const [communities, activeCommunityId] = await Promise.all([
    listAccessibleCommunities(session),
    getActiveCommunityId(session),
  ]);

  return ok({ communities, activeCommunityId });
}
