import { render, fireEvent } from '@testing-library/react-native';
import UsersList from '../../../app/(admin)/more/users/index';
import { listUsers } from '@/api/admin';
import { ApiError } from '@/api/client';
import { router } from 'expo-router';
import type { AdminUserListItem } from '@/types/admin';

jest.mock('@/api/admin');
jest.mock('expo-router', () => ({
  router: { push: jest.fn() },
  Stack: { Screen: () => null },
}));

const mockedListUsers = listUsers as jest.Mock;

function makeUser(overrides: Partial<AdminUserListItem> = {}): AdminUserListItem {
  return {
    id: 'r1',
    firstName: 'Demo',
    lastName: 'Resident',
    email: 'r@communityhq.local',
    role: 'RESIDENT',
    createdAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('UsersList (admin)', () => {
  beforeEach(() => jest.clearAllMocks());

  it('shows an error view on failure', async () => {
    mockedListUsers.mockRejectedValue(new ApiError('Network error', 500));
    const { findByText } = await render(<UsersList />);
    expect(await findByText('Network error')).toBeTruthy();
  });

  it('renders a user with their role badge and navigates on press', async () => {
    mockedListUsers.mockResolvedValue([makeUser({ id: 'r1', firstName: 'Demo', lastName: 'Resident' })]);
    const { findByText } = await render(<UsersList />);
    const row = await findByText('Demo Resident');
    expect(await findByText('Resident')).toBeTruthy();
    fireEvent.press(row);
    expect(router.push).toHaveBeenCalledWith('/more/users/r1');
  });
});
