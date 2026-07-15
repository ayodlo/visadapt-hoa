import { render, fireEvent, act } from '@testing-library/react-native';
import NewUser from '../../../app/(admin)/more/users/new';
import { createUser } from '@/api/admin';
import { ApiError } from '@/api/client';
import { useAuth } from '@/auth/AuthContext';
import { router } from 'expo-router';

jest.mock('@/api/admin');
jest.mock('@/auth/AuthContext', () => ({ useAuth: jest.fn() }));
jest.mock('expo-router', () => ({ router: { replace: jest.fn() } }));

const mockedCreateUser = createUser as jest.Mock;
const mockedUseAuth = useAuth as jest.Mock;

// FormField has no placeholder for name/email fields, so locate the inputs
// by render order instead: [firstName, lastName, email, password].
async function fillForm(getAllByDisplayValue: (v: string) => unknown[]) {
  const [firstNameInput, lastNameInput, emailInput] = getAllByDisplayValue('') as never[];
  await act(async () => {
    fireEvent.changeText(firstNameInput, 'New');
  });
  await act(async () => {
    fireEvent.changeText(lastNameInput, 'User');
  });
  await act(async () => {
    fireEvent.changeText(emailInput, 'new.user@communityhq.local');
  });
}

describe('NewUser (admin)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedUseAuth.mockReturnValue({ user: { role: 'ADMIN' }, communities: [] });
  });

  it('does not show a community picker for a regular ADMIN', async () => {
    const { queryByText } = await render(<NewUser />);
    expect(queryByText(/Communities \(defaults/)).toBeNull();
  });

  it('shows a community picker for SUPER_ADMIN creating a non-resident', async () => {
    mockedUseAuth.mockReturnValue({
      user: { role: 'SUPER_ADMIN' },
      communities: [{ id: 'c1', name: 'Maple Ridge' }, { id: 'c2', name: 'Oak Hollow' }],
    });
    const { getByText, queryByText } = await render(<NewUser />);
    expect(queryByText(/Communities \(defaults/)).toBeNull();

    await act(async () => {
      fireEvent.press(getByText('Board Member'));
    });
    expect(getByText(/Communities \(defaults/)).toBeTruthy();
    expect(getByText('Maple Ridge')).toBeTruthy();
    expect(getByText('Oak Hollow')).toBeTruthy();
  });

  it('disables submit until the form is valid', async () => {
    const { getByText } = await render(<NewUser />);
    await act(async () => {
      fireEvent.press(getByText('Create User'));
    });
    expect(mockedCreateUser).not.toHaveBeenCalled();
  });

  it('creates a user with the default RESIDENT role and navigates back to the list', async () => {
    mockedCreateUser.mockResolvedValue({ id: 'u2' });
    const { getAllByDisplayValue, getByPlaceholderText, getByText } = await render(<NewUser />);

    await fillForm(getAllByDisplayValue);
    await act(async () => {
      fireEvent.changeText(getByPlaceholderText('At least 8 characters'), 'password123');
    });
    await act(async () => {
      fireEvent.press(getByText('Create User'));
    });

    expect(mockedCreateUser).toHaveBeenCalledWith({
      firstName: 'New',
      lastName: 'User',
      email: 'new.user@communityhq.local',
      password: 'password123',
      role: 'RESIDENT',
    });
    expect(router.replace).toHaveBeenCalledWith('/more/users');
  });

  it('creates a user with a different role when selected', async () => {
    mockedCreateUser.mockResolvedValue({ id: 'u2' });
    const { getAllByDisplayValue, getByPlaceholderText, getByText } = await render(<NewUser />);

    await fillForm(getAllByDisplayValue);
    await act(async () => {
      fireEvent.changeText(getByPlaceholderText('At least 8 characters'), 'password123');
    });
    await act(async () => {
      fireEvent.press(getByText('Board Member'));
    });
    await act(async () => {
      fireEvent.press(getByText('Create User'));
    });

    expect(mockedCreateUser).toHaveBeenCalledWith(expect.objectContaining({ role: 'BOARD_MEMBER' }));
  });

  it('shows an error message when creation fails', async () => {
    mockedCreateUser.mockRejectedValue(new ApiError('Email already in use', 409));
    const { getAllByDisplayValue, getByPlaceholderText, getByText } = await render(<NewUser />);

    await fillForm(getAllByDisplayValue);
    await act(async () => {
      fireEvent.changeText(getByPlaceholderText('At least 8 characters'), 'password123');
    });
    await act(async () => {
      fireEvent.press(getByText('Create User'));
    });

    expect(getByText('Email already in use')).toBeTruthy();
  });
});
