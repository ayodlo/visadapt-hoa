import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import { isAdmin } from '@/lib/roles';

export default async function DashboardDocumentsRedirect() {
  const session = await getSession();
  if (!session) redirect('/login');
  if (isAdmin(session.role)) redirect('/admin/documents');
  if (session.role === 'BOARD_MEMBER') redirect('/board/documents');
  redirect('/resident/documents');
}
