import { getSession } from '@/lib/auth';
import { ok, unauthorized, forbidden } from '@/lib/api';
import { getResidentDashboard } from '@/lib/dashboard';

export async function GET() {
  const session = await getSession();
  if (!session) return unauthorized();
  if (session.role !== 'RESIDENT') return forbidden();

  try {
    const data = await getResidentDashboard(session.id);
    return ok(data);
  } catch {
    return ok({ error: 'Failed to load dashboard data' }, 500);
  }
}
