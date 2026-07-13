import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import { isAdmin } from '@/lib/roles';

export default async function DashboardPage() {
  const session = await getSession();
  if (!session) redirect('/login');
  if (isAdmin(session.role)) redirect('/admin/dashboard');
  if (session.role === 'BOARD_MEMBER') redirect('/board/dashboard');
  redirect('/resident/dashboard');
}
