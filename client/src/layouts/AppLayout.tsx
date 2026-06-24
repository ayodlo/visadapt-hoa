import { Outlet, Link, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { dashboardPath, fullName } from '../types';

const SHARED_NAV = [
  { to: 'announcements', label: 'Announcements' },
  { to: 'documents', label: 'Documents' },
  { to: 'maintenance', label: 'Maintenance' },
  { to: 'dues', label: 'Dues' },
  { to: 'events', label: 'Events' },
  { to: 'polls', label: 'Polls' },
];

const navClass = ({ isActive }: { isActive: boolean }) =>
  `block px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
    isActive
      ? 'bg-brand-50 text-brand-700'
      : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
  }`;

function roleLabel(role: string) {
  return role.replace('_', ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

export function AppLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  function handleLogout() {
    logout();
    navigate('/login', { replace: true });
  }

  const dashHome = user ? dashboardPath(user.role) : '/login';

  return (
    <div className="flex min-h-screen bg-gray-50">
      <aside className="fixed inset-y-0 left-0 w-56 bg-white border-r border-gray-200 flex flex-col">
        <div className="px-5 h-16 flex items-center border-b border-gray-100 shrink-0">
          <Link to={dashHome} className="text-brand-700 font-bold text-lg tracking-tight">
            CommunityHQ
          </Link>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
          <NavLink to={dashHome} end className={navClass}>
            Dashboard
          </NavLink>

          {SHARED_NAV.map(({ to, label }) => (
            <NavLink key={to} to={`/${to}`} className={navClass}>
              {label}
            </NavLink>
          ))}

          {user?.role === 'ADMIN' && (
            <>
              <p className="px-3 pt-5 pb-1 text-xs font-semibold text-gray-400 uppercase tracking-wider">
                Admin
              </p>
              <NavLink to="/users" className={navClass}>
                Users
              </NavLink>
            </>
          )}
        </nav>

        <div className="px-4 py-4 border-t border-gray-100 space-y-3 shrink-0">
          <Link to="/profile" className="block group">
            <p className="text-sm font-medium text-gray-900 truncate group-hover:text-brand-700 transition-colors">
              {user ? fullName(user) : ''}
            </p>
            <p className="text-xs text-gray-400 truncate">{user?.email}</p>
            <p className="text-xs text-gray-400 mt-0.5">{user && roleLabel(user.role)}</p>
          </Link>
          <button
            onClick={handleLogout}
            className="text-sm text-gray-400 hover:text-red-500 transition-colors"
          >
            Sign out
          </button>
        </div>
      </aside>

      <div className="ml-56 flex-1 flex flex-col min-h-screen">
        <main className="flex-1 px-8 py-8">
          <Outlet />
        </main>
        <footer className="border-t border-gray-200 py-4">
          <p className="text-center text-xs text-gray-400">
            &copy; {new Date().getFullYear()} CommunityHQ
          </p>
        </footer>
      </div>
    </div>
  );
}
