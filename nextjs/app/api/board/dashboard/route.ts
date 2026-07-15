import { getSession } from '@/lib/auth';
import { getActiveCommunityId } from '@/lib/community';
import { ok, err, unauthorized, forbidden } from '@/lib/api';
import { getBoardDashboard } from '@/lib/dashboard';

export async function GET() {
  const session = await getSession();
  if (!session) return unauthorized();
  if (session.role === 'RESIDENT') return forbidden();

  const communityId = await getActiveCommunityId(session);
  if (!communityId) return err('No community selected', 400);

  try {
    const data = await getBoardDashboard(communityId);
    return ok(data);
  } catch {
    return ok({ error: 'Failed to load dashboard data' }, 500);
  }
}
