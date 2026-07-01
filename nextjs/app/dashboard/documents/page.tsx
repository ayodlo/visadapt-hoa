import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';

export default async function DashboardDocumentsRedirect() {
  const session = await getSession();
  if (!session) redirect('/login');
  if (session.role === 'ADMIN') redirect('/admin/documents');
  if (session.role === 'BOARD_MEMBER') redirect('/board/documents');
  redirect('/resident/documents');
}
