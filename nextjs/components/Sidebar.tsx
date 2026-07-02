'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import type { SessionUser } from '@/lib/auth';

function dashboardHref(role: SessionUser['role']) {
  if (role === 'ADMIN') return '/admin/dashboard';
  if (role === 'BOARD_MEMBER') return '/board/dashboard';
  return '/resident/dashboard';
}

function documentsHref(role: SessionUser['role']) {
  if (role === 'ADMIN') return '/admin/documents';
  if (role === 'BOARD_MEMBER') return '/board/documents';
  return '/resident/documents';
}

function paymentsHref(role: SessionUser['role']) {
  if (role === 'ADMIN') return '/admin/payments';
  if (role === 'RESIDENT') return '/resident/payments';
  return '/dashboard/dues';
}

function announcementsHref(role: SessionUser['role']) {
  if (role === 'ADMIN' || role === 'BOARD_MEMBER') return '/admin/announcements';
  return '/resident/announcements';
}

function issuesHref(role: SessionUser['role']) {
  if (role === 'ADMIN' || role === 'BOARD_MEMBER') return '/admin/issues';
  return '/resident/issues';
}

function archRequestsHref(role: SessionUser['role']) {
  if (role === 'ADMIN') return '/admin/architectural-requests';
  if (role === 'BOARD_MEMBER') return '/board/architectural-requests';
  return '/resident/architectural-requests';
}

function buildNav(role: SessionUser['role']) {
  const home = dashboardHref(role);
  const docs = documentsHref(role);
  const payments = paymentsHref(role);
  const announcements = announcementsHref(role);
  const issues = issuesHref(role);
  const arch = archRequestsHref(role);
  const paymentsLabel = role === 'BOARD_MEMBER' ? 'Dues' : 'Payments';
  const isAdmin = role === 'ADMIN' || role === 'BOARD_MEMBER';
  const items = [
    { href: home, label: 'Dashboard', icon: '🏠' },
    { href: announcements, label: 'Announcements', icon: '📢' },
    { href: '/dashboard/events', label: 'Events', icon: '📅' },
    { href: issues, label: 'Issues', icon: '🔨' },
    { href: arch, label: 'Arch. Requests', icon: '🏗️' },
    { href: '/dashboard/maintenance', label: 'Maintenance', icon: '🔧' },
    { href: '/dashboard/polls', label: 'Polls', icon: '📊' },
    { href: payments, label: paymentsLabel, icon: '💰' },
    { href: docs, label: 'Documents', icon: '📄' },
  ];
  if (isAdmin) items.push({ href: '/dashboard/users', label: 'Users', icon: '👥' });
  return items;
}

interface Props {
  user: SessionUser;
}

export default function Sidebar({ user }: Props) {
  const pathname = usePathname();
  const router = useRouter();
  const nav = buildNav(user.role);
  const home = dashboardHref(user.role);

  async function handleLogout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/login');
    router.refresh();
  }

  return (
    <aside className="hidden md:flex w-56 flex-shrink-0 bg-white border-r border-gray-200 flex-col">
      <div className="px-4 py-5 border-b border-gray-200">
        <span className="text-lg font-bold text-blue-600">CommunityHQ</span>
      </div>

      <nav className="flex-1 px-2 py-4 space-y-0.5 overflow-y-auto" aria-label="Main navigation">
        {nav.map((item) => {
          const isDashHome = item.href === home;
          const active = isDashHome
            ? pathname === item.href
            : pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                active ? 'bg-blue-50 text-blue-700' : 'text-gray-600 hover:bg-gray-100'
              }`}
              aria-current={active ? 'page' : undefined}
            >
              <span aria-hidden="true">{item.icon}</span>
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
