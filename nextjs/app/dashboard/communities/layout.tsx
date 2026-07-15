import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';

export default async function CommunitiesLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session) redirect('/login');
  if (session.role !== 'SUPER_ADMIN') redirect('/dashboard/users');
  return <>{children}</>;
}
