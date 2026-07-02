import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';

export default async function UsersLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session) redirect('/login');
  if (session.role === 'RESIDENT') redirect('/resident/dashboard');
  return <>{children}</>;
}
