import { getSession } from '@/lib/auth';
import { unauthorized, forbidden } from '@/lib/api';

/**
 * Resident comment on an architectural request — closed.
 *
 * Only residents could post here. Staff comment through
 * /api/admin/architectural-requests/[id]/comments instead.
 */
export async function POST() {
  const session = await getSession();
  if (!session) return unauthorized();
  return forbidden();
}
