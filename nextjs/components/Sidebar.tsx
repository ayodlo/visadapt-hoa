'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import type { SessionUser } from '@/lib/auth';
import { buildNav, dashboardHref, isNavItemActive } from '@/lib/nav';
import ThemeToggle from '@/components/ThemeToggle';

interface Props {
  user: SessionUser;
}

export default function Sidebar({ user }: Props) {
  const pathname = usePathname();
  const router = useRouter();
  const nav = buildNav(user.role);

  async function handleLogout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/login');
    router.refresh();
  }

  return (
    <aside className="hidden md:flex w-56 flex-shrink-0 bg-white border-r border-gray-200 flex-col">
      <div className="flex items-center justify-between px-4 py-4 border-b border-gray-200">
        <Link
          href={dashboardHref(user.role)}
          className="text-lg font-bold text-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 rounded"
        >
          CommunityHQ
        </Link>
        <ThemeToggle />
      </div>

      <nav className="flex-1 px-2 py-4 space-y-0.5 overflow-y-auto" aria-label="Main navigation">
        {nav.map((item) => {
          const active = isNavItemActive(item, pathname, user.role);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                active ? 'bg-blue-50 text-blue-700' : 'text-gray-600 hover:bg-gray-100'
              }`}
              aria-current={active ? 'page' : undefined}
            >
              <item.icon className="w-4 h-4 flex-shrink-0" aria-hidden="true" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="px-4 py-4 border-t border-gray-200">
        <Link
          href="/dashboard/profile"
          className="block mb-0.5 text-xs font-medium text-gray-900 truncate hover:text-blue-600 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 rounded"
        >
          {user.firstName} {user.lastName}
        </Link>
        <p className="text-xs text-gray-500 truncate mb-3">{user.email}</p>
        <button
          onClick={handleLogout}
          className="w-full text-left text-xs text-gray-500 hover:text-red-600 transition-colors focus:outline-none focus:ring-2 focus:ring-red-500 rounded"
        >
          Sign out
        </button>
      </div>
    </aside>
  );
}
