import type { SessionUser } from '@/lib/auth';
import type { LucideIcon } from 'lucide-react';
import {
  LayoutDashboard,
  Megaphone,
  Calendar,
  Hammer,
  PencilRuler,
  TriangleAlert,
  Wrench,
  ChartColumn,
  Wallet,
  FileText,
  Users,
} from 'lucide-react';

type Role = SessionUser['role'];

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
}

export function dashboardHref(role: Role) {
  if (role === 'ADMIN') return '/admin/dashboard';
  if (role === 'BOARD_MEMBER') return '/board/dashboard';
  return '/resident/dashboard';
}

function documentsHref(role: Role) {
  if (role === 'ADMIN') return '/admin/documents';
  if (role === 'BOARD_MEMBER') return '/board/documents';
  return '/resident/documents';
}

function paymentsHref(role: Role) {
  if (role === 'ADMIN') return '/admin/payments';
  if (role === 'RESIDENT') return '/resident/payments';
  return '/dashboard/dues';
}

function announcementsHref(role: Role) {
  if (role === 'ADMIN' || role === 'BOARD_MEMBER') return '/admin/announcements';
  return '/resident/announcements';
}

function issuesHref(role: Role) {
  if (role === 'ADMIN' || role === 'BOARD_MEMBER') return '/admin/issues';
  return '/resident/issues';
}

function archRequestsHref(role: Role) {
  if (role === 'ADMIN') return '/admin/architectural-requests';
  if (role === 'BOARD_MEMBER') return '/board/architectural-requests';
  return '/resident/architectural-requests';
}

function violationsHref(role: Role) {
  if (role === 'ADMIN') return '/admin/violations';
  if (role === 'BOARD_MEMBER') return '/board/violations';
  return '/resident/violations';
}

export function buildNav(role: Role): NavItem[] {
  const paymentsLabel = role === 'BOARD_MEMBER' ? 'Dues' : 'Payments';
  const isAdmin = role === 'ADMIN' || role === 'BOARD_MEMBER';
  const items: NavItem[] = [
    { href: dashboardHref(role), label: 'Dashboard', icon: LayoutDashboard },
    { href: announcementsHref(role), label: 'Announcements', icon: Megaphone },
    { href: '/dashboard/events', label: 'Events', icon: Calendar },
    { href: issuesHref(role), label: 'Issues', icon: Hammer },
    { href: archRequestsHref(role), label: 'Arch. Requests', icon: PencilRuler },
    { href: violationsHref(role), label: 'Violations', icon: TriangleAlert },
    { href: '/dashboard/maintenance', label: 'Maintenance', icon: Wrench },
    { href: '/dashboard/polls', label: 'Polls', icon: ChartColumn },
    { href: paymentsHref(role), label: paymentsLabel, icon: Wallet },
    { href: documentsHref(role), label: 'Documents', icon: FileText },
  ];
  if (isAdmin) items.push({ href: '/dashboard/users', label: 'Users', icon: Users });
  return items;
}

export function isNavItemActive(item: NavItem, pathname: string, role: Role) {
  return item.href === dashboardHref(role)
    ? pathname === item.href
    : pathname.startsWith(item.href);
}
