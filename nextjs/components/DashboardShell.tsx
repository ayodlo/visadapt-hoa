import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import { SessionProvider } from '@/context/session';
import { ToastProvider } from '@/context/toast';
import Sidebar from '@/components/Sidebar';
import MobileNav from '@/components/MobileNav';

export default async function DashboardShell({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();
  if (!session) redirect('/login');

  return (
    <SessionProvider user={session}>
      <ToastProvider>
        <div className="flex h-screen overflow-hidden">
          <Sidebar user={session} />
          <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
            <MobileNav user={session} />
            <main className="flex-1 overflow-y-auto bg-gray-50 p-4 md:p-6">
              {children}
            </main>
          </div>
        </div>
      </ToastProvider>
    </SessionProvider>
  );
}
