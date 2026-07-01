import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import Sidebar from '@/components/Sidebar';
import { SessionProvider } from '@/context/session';

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session) redirect('/login');

  return (
    <SessionProvider user={session}>
      <div className="flex h-screen overflow-hidden">
        <Sidebar user={session} />
        <main className="flex-1 overflow-y-auto bg-gray-50 p-6">{children}</main>
      </div>
    </SessionProvider>
  );
}
