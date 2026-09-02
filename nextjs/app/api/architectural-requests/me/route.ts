import { getSession } from '@/lib/auth';
import { unauthorized, forbidden } from '@/lib/api';

/**
 * A resident's own architectural requests — closed.
 *
 * Architectural requests are staff-only; residents no longer submit or track
 * them in the app. Kept as a 403 rather than deleted so any still-deployed
 * mobile client gets a clear refusal instead of a 404.
 */
export async function GET() {
  const session = await getSession();
  if (!session) return unauthorized();
  return forbidden();
}
