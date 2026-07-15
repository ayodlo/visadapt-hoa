import { Alert } from 'react-native';
import { render, fireEvent, act } from '@testing-library/react-native';
import EditUser from '../../../app/(admin)/more/users/[id]';
import { getUser, updateUser, deleteUser } from '@/api/admin';
import { listProperties } from '@/api/properties';
import { useAuth } from '@/auth/AuthContext';
import { ApiError } from '@/api/client';
import { router } from 'expo-router';
import type { AdminUserDetail } from '@/types/admin';

jest.mock('@/api/admin');
jest.mock('@/api/properties');
jest.mock('@/api/community');
jest.mock('@/auth/AuthContext', () => ({ useAuth: jest.fn() }));
jest.mock('expo-router', () => ({ useLocalSearchParams: () => ({ id: 'r1' }), router: { replace: jest.fn() } }));

const mockedGetUser = getUser as jest.Mock;
const mockedUpdateUser = updateUser as jest.Mock;
const mockedDeleteUser = deleteUser as jest.Mock;
const mockedListProperties = listProperties as jest.Mock;
const mockedUseAuth = useAuth as jest.Mock;

function makeUser(overrides: Partial<AdminUserDetail> = {}): AdminUserDetail {
  return {
    id: 'r1',
    firstName: 'Demo',
    lastName: 'Resident',
    email: 'r@communityhq.local',
    role: 'RESIDENT',
    createdAt: '2026-01-01T00:00:00.000Z',
    communityId: 'c1',
    community: { name: 'CommunityHQ Demo' },
    ...overrides,
  };
}

describe('EditUser (admin)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedUseAuth.mockReturnValue({ user: { id: 'admin1', role: 'ADMIN' }, communities: [] });
    mockedListProperties.mockResolvedValue([]);
  });

  it('shows an error view when the user cannot be found', async () => {
    mockedGetUser.mockRejectedValue(new ApiError('User not found', 404));
    const { findByText } = await render(<EditUser />);
    expect(await findByText('User not found')).toBeTruthy();
  });

  it('saves updated fields', async () => {
    mockedGetUser.mockResolvedValueOnce(makeUser());
    mockedGetUser.mockResolvedValueOnce(makeUser({ firstName: 'Updated' }));
    mockedUpdateUser.mockResolvedValue(makeUser({ firstName: 'Updated' }));

    const { findByDisplayValue, getByText } = await render(<EditUser />);
    const firstNameInput = await findByDisplayValue('Demo');

    await act(async () => {
      fireEvent.changeText(firstNameInput, 'Updated');
    });
    await act(async () => {
      fireEvent.press(getByText('Save'));
    });

    expect(mockedUpdateUser).toHaveBeenCalledWith('r1', expect.objectContaining({ firstName: 'Updated' }));
    expect(getByText('Saved.')).toBeTruthy();
  });

  it('deletes the user after confirming the alert', async () => {
    mockedGetUser.mockResolvedValue(makeUser());
    mockedDeleteUser.mockResolvedValue({ deleted: true });
    jest.spyOn(Alert, 'alert').mockImplementation((_t, _m, buttons) => {
      buttons?.find((b) => b.text === 'Delete')?.onPress?.();
    });

    const { findByText, getByText } = await render(<EditUser />);
    await findByText(/r@communityhq.local/);

    await act(async () => {
      fireEvent.press(getByText('Delete User'));
    });

    expect(mockedDeleteUser).toHaveBeenCalledWith('r1');
    expect(router.replace).toHaveBeenCalledWith('/more/users');
  });

  it('does not show a delete button when viewing your own account', async () => {
    mockedUseAuth.mockReturnValue({ user: { id: 'r1', role: 'ADMIN' }, communities: [] });
    mockedGetUser.mockResolvedValue(makeUser({ id: 'r1' }));

    const { findByText, queryByText } = await render(<EditUser />);
    await findByText(/r@communityhq.local/);

    expect(queryByText('Delete User')).toBeNull();
    expect(await findByText('You cannot delete your own account.')).toBeTruthy();
  });

  it('locks out editing for a SUPER_ADMIN target', async () => {
    mockedGetUser.mockResolvedValue(makeUser({ role: 'SUPER_ADMIN', community: null, communityId: null }));
    const { findByText, queryByText } = await render(<EditUser />);
    expect(await findByText('SUPER_ADMIN accounts cannot be edited here.')).toBeTruthy();
    expect(queryByText('Save')).toBeNull();
    expect(queryByText('Delete User')).toBeNull();
  });

  it('shows read-only community assignments for a BOARD_MEMBER target to a regular ADMIN', async () => {
    mockedGetUser.mockResolvedValue(
      makeUser({
        role: 'BOARD_MEMBER',
        community: null,
        communityId: null,
        communityAssignments: [{ communityId: 'c1', community: { name: 'Maple Ridge' } }],
      })
    );
    const { findByText, queryByText } = await render(<EditUser />);
    expect(await findByText('Maple Ridge')).toBeTruthy();
    expect(queryByText('Save Assignments')).toBeNull();
  });
});
