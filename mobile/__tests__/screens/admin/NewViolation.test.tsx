import { render, fireEvent, act } from '@testing-library/react-native';
import NewViolation from '../../../app/(admin)/violations/new';
import { listUsers, createViolation } from '@/api/admin';
import { ApiError } from '@/api/client';
import { router } from 'expo-router';
import type { AdminUserListItem } from '@/types/admin';

jest.mock('@/api/admin');
jest.mock('expo-router', () => ({ router: { replace: jest.fn() } }));

const mockedListUsers = listUsers as jest.Mock;
const mockedCreateViolation = createViolation as jest.Mock;

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

describe('NewViolation (admin)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedListUsers.mockResolvedValue([makeUser(), makeUser({ id: 'staff1', firstName: 'Staff', lastName: 'Member', role: 'ADMIN' })]);
  });

  it('lists only residents in the picker', async () => {
    const { findByText, queryByText } = await render(<NewViolation />);
    expect(await findByText('Demo Resident')).toBeTruthy();
    expect(queryByText('Staff Member')).toBeNull();
  });

  it('selects a resident and hides the picker', async () => {
    const { findByText, queryByPlaceholderText } = await render(<NewViolation />);
    const row = await findByText('Demo Resident');

    await act(async () => {
      fireEvent.press(row);
    });

    expect(queryByPlaceholderText('Name or email')).toBeNull();
  });

  it('submits the violation with the selected resident', async () => {
    mockedCreateViolation.mockResolvedValue({});
    const { findByText, getByText, getByPlaceholderText } = await render(<NewViolation />);
    const row = await findByText('Demo Resident');

    await act(async () => {
      fireEvent.press(row);
    });
    await act(async () => {
      fireEvent.changeText(getByPlaceholderText('e.g. CC&Rs Section 6.1'), 'Section 6.1');
    });
    await act(async () => {
      fireEvent.changeText(getByPlaceholderText('Describe the violation (min 10 characters)'), 'Loud music after 10pm');
    });
    await act(async () => {
      fireEvent.press(getByText('Save as Draft'));
    });

    expect(mockedCreateViolation).toHaveBeenCalledWith(
      expect.objectContaining({ residentId: 'r1', ruleCitation: 'Section 6.1', description: 'Loud music after 10pm', sendNow: false })
    );
    expect(router.replace).toHaveBeenCalledWith('/violations');
  });

  it('shows an error message when submission fails', async () => {
    mockedCreateViolation.mockRejectedValue(new ApiError('Something went wrong', 500));
    const { findByText, getByText, getByPlaceholderText } = await render(<NewViolation />);
    const row = await findByText('Demo Resident');

    await act(async () => {
      fireEvent.press(row);
    });
    await act(async () => {
      fireEvent.changeText(getByPlaceholderText('e.g. CC&Rs Section 6.1'), 'Section 6.1');
    });
    await act(async () => {
      fireEvent.changeText(getByPlaceholderText('Describe the violation (min 10 characters)'), 'Loud music after 10pm');
    });
    await act(async () => {
      fireEvent.press(getByText('Save as Draft'));
    });

    expect(getByText('Something went wrong')).toBeTruthy();
  });
});
