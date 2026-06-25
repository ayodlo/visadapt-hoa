'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import type { SessionUser } from '@/lib/auth';

const NAV = [
  { href: '/dashboard', label: 'Dashboard', icon: '🏠' },
  { href: '/dashboard/announcements', label: 'Announcements', icon: '📢' },
  { href: '/dashboard/events', label: 'Events', icon: '📅' },
  { href: '/dashboard/maintenance', label: 'Maintenance', icon: '🔧' },
  { href: '/dashboard/polls', label: 'Polls', icon: '📊' },
  { href: '/dashboard/dues', label: 'Dues', icon: '💰' },
  { href: '/dashboard/documents', label: 'Documents', icon: '📄' },
];

const ADMIN_NAV = [
  { href: '/dashboard/users', label: 'Users', icon: '👥' },
];

interface Props {
  user: SessionUser;
}

export default function Sidebar({ user }: Props) {
  const pathname = usePathname();
  const router = useRouter();

  async function handleLogout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/login');
    router.refresh();
  }

  const isAdmin = user.role === 'ADMIN' || user.role === 'BOARD_MEMBER';
  const allNav = isAdmin ? [...NAV, ...ADMIN_NAV] : NAV;

  return (
    <aside className="w-56 flex-shrink-0 bg-white border-r border-gray-200 flex flex-col">
      <div className="px-4 py-5 border-b border-gray-200">
        <span className="text-lg font-bold text-blue-600">CommunityHQ</span>
      </div>

      <nav className="flex-1 px-2 py-4 space-y-0.5 overflow-y-auto">
        {allNav.map((item) => {
          const active = pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href));
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                active ? 'bg-blue-50 text-blue-700' : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              <span>{item.icon}</span>
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="px-4 py-4 border-t border-gray-200">
        <p className="text-xs font-medium text-gray-900 truncate">{user.firstName} {user.lastName}</p>
        <p className="text-xs text-gray-500 truncate mb-3">{user.email}</p>
        <button
          onClick={handleLogout}
          className="w-full text-left text-xs text-gray-500 hover:text-red-600 transition-colors"
        >
          Sign out
        </button>
      </div>
    </aside>
  );
}
