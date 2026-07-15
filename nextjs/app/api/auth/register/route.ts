import { err } from '@/lib/api';

// Public self-registration is disabled now that the app is multi-tenant —
// there's no way to know which HOA community a stranger actually belongs to.
// Residents are created by an admin (POST /api/users), which assigns a
// community as part of creation. This route is kept (rather than deleted)
// so old clients get a clear, actionable error instead of a 404.
export async function POST() {
  return err('Self-registration is disabled. Contact your HOA administrator to be added to CommunityHQ.', 403);
}
