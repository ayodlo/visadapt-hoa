import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import { isAdmin } from '@/lib/roles';

/**
 * Architectural requests are staff-only.
 *
 * Residents no longer submit or track them in the app, so every route beneath
 * this layout redirects and the pages below never render. They are kept rather
 * than deleted because the product decision behind this is reversible —
 * restoring access is a change to this file alone.
 */
export default async function ResidentArchRequestsLayout() {
  const session = await getSession();
  if (!session) redirect('/login');
  if (session.role === 'RESIDENT') redirect('/resident/dashboard');
  redirect(isAdmin(session.role) ? '/admin/architectural-requests' : '/board/architectural-requests');
}
