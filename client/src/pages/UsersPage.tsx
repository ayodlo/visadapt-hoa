import { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { apiClient } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { UserRole, fullName } from '../types';
import { Pagination } from '../components/Pagination';

interface ManagedUser {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  role: UserRole;
  createdAt: string;
}

interface UsersResponse {
  users: ManagedUser[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
}

const ROLE_LABELS: Record<UserRole, string> = {
  ADMIN: 'Admin',
  BOARD_MEMBER: 'Board Member',
  RESIDENT: 'Resident',
};

const ROLE_BADGE: Record<UserRole, string> = {
  ADMIN: 'bg-purple-100 text-purple-700',
  BOARD_MEMBER: 'bg-blue-100 text-blue-700',
  RESIDENT: 'bg-gray-100 text-gray-600',
};

export function UsersPage() {
  const { user: currentUser } = useAuth();
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  function handleSearch(value: string) {
    setSearch(value);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setDebouncedSearch(value);
      setPage(1);
    }, 350);
  }

  const { data, isLoading, isError } = useQuery({
    queryKey: ['users', page, debouncedSearch],
    queryFn: () => {
      const params = new URLSearchParams({ page: String(page), limit: '10' });
      if (debouncedSearch) params.set('search', debouncedSearch);
      return apiClient.get<UsersResponse>(`/api/users?${params}`);
    },
    placeholderData: keepPreviousData,
  });

  const { mutate: changeRole, variables } = useMutation({
    mutationFn: ({ id, role }: { id: string; role: UserRole }) =>
      apiClient.patch<{ user: ManagedUser }>(`/api/users/${id}/role`, { role }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['users'] }),
  });

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Residents & Members</h1>
      </div>

      <input
        type="search"
        value={search}
        onChange={(e) => handleSearch(e.target.value)}
        placeholder="Search by name or email…"
        className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
      />

      {isLoading && (
        <p className="text-sm text-gray-400 text-center py-12">Loading users…</p>
      )}

      {isError && (
        <p className="text-sm text-red-500 text-center py-12">Failed to load users.</p>
      )}

      {data && (
        <>
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50 text-left">
                  <th className="px-6 py-3 font-medium text-gray-500">Name</th>
                  <th className="px-6 py-3 font-medium text-gray-500">Email</th>
                  <th className="px-6 py-3 font-medium text-gray-500">Role</th>
                  <th className="px-6 py-3 font-medium text-gray-500">Joined</th>
                  <th className="px-6 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {data.users.map((u) => {
                  const isSelf = u.id === currentUser?.id;
                  const isPending = variables?.id === u.id;
                  return (
                    <tr key={u.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4 font-medium text-gray-900">
                        {fullName(u)}
                        {isSelf && (
                          <span className="ml-2 text-xs text-gray-400">(you)</span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-gray-500">{u.email}</td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${ROLE_BADGE[u.role]}`}>
                          {ROLE_LABELS[u.role]}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-gray-400">
                        {new Date(u.createdAt).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4 text-right">
                        {!isSelf && (
                          <select
                            value={u.role}
                            disabled={isPending}
                            onChange={(e) => changeRole({ id: u.id, role: e.target.value as UserRole })}
                            className="text-xs border border-gray-200 rounded-md px-2 py-1 bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-brand-500 disabled:opacity-50"
                          >
                            {(Object.keys(ROLE_LABELS) as UserRole[]).map((r) => (
                              <option key={r} value={r}>{ROLE_LABELS[r]}</option>
                            ))}
                          </select>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <Pagination pagination={data.pagination} onChange={setPage} />
        </>
      )}
    </div>
  );
}
