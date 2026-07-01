import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';

export default async function DashboardPage() {
  const session = await getSession();
  if (!session) redirect('/login');
  if (session.role === 'ADMIN') redirect('/admin/dashboard');
  if (session.role === 'BOARD_MEMBER') redirect('/board/dashboard');
  redirect('/resident/dashboard');
}
