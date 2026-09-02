import { getSession } from '@/lib/auth';
import { unauthorized, forbidden } from '@/lib/api';

/**
 * Architectural request submission — closed.
 *
 * Residents no longer submit architectural requests through the app; that
 * process is handled outside it. This route only ever accepted RESIDENT
 * submissions, so it is now closed to every role rather than deleted, which
 * keeps the endpoint returning a clear 403 to any still-deployed mobile client
 * instead of a confusing 404.
 *
 * Staff continue to review and decide existing requests through
 * /api/admin/architectural-requests and /api/board/architectural-requests.
 */
export async function POST() {
  const session = await getSession();
  if (!session) return unauthorized();
  return forbidden();
}
