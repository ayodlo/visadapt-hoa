import { render, fireEvent, act } from '@testing-library/react-native';
import { ProfileScreen } from '@/screens/shared/ProfileScreen';
import { useAuth } from '@/auth/AuthContext';
import { updateProfile, changePassword } from '@/api/profile';
import { ApiError } from '@/api/client';
import type { SessionUser } from '@/types/auth';

jest.mock('@/auth/AuthContext', () => ({ useAuth: jest.fn() }));
jest.mock('@/api/profile');

const mockedUseAuth = useAuth as jest.Mock;
const mockedUpdateProfile = updateProfile as jest.Mock;
const mockedChangePassword = changePassword as jest.Mock;

const user: SessionUser = { id: 'u1', email: 'r@communityhq.local', firstName: 'Demo', lastName: 'Resident', role: 'RESIDENT', communityId: 'c1' };

describe('ProfileScreen', () => {
  const updateUser = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    mockedUseAuth.mockReturnValue({ user, updateUser });
  });

  it('renders the current email and role', async () => {
    const { findByText } = await render(<ProfileScreen />);
    expect(await findByText(/r@communityhq.local/)).toBeTruthy();
    expect(await findByText(/Resident/)).toBeTruthy();
  });

  it('pre-fills the name fields from the current user', async () => {
    const { findByDisplayValue } = await render(<ProfileScreen />);
    expect(await findByDisplayValue('Demo')).toBeTruthy();
    expect(await findByDisplayValue('Resident')).toBeTruthy();
  });

  it('saves the profile and updates the auth context on success', async () => {
    const updated = { ...user, firstName: 'Updated' };
    mockedUpdateProfile.mockResolvedValue({ user: updated });
    const { findByDisplayValue, getByText } = await render(<ProfileScreen />);
    const firstNameInput = await findByDisplayValue('Demo');

    await act(async () => {
      fireEvent.changeText(firstNameInput, 'Updated');
    });
    await act(async () => {
      fireEvent.press(getByText('Save Profile'));
    });

    expect(mockedUpdateProfile).toHaveBeenCalledWith('Updated', 'Resident');
    expect(updateUser).toHaveBeenCalledWith(updated);
    expect(getByText('Profile updated.')).toBeTruthy();
  });

  it('shows an error message when saving the profile fails', async () => {
    mockedUpdateProfile.mockRejectedValue(new ApiError('Name is required', 400));
    const { findByText, getByText } = await render(<ProfileScreen />);
    await findByText(/r@communityhq.local/);

    await act(async () => {
      fireEvent.press(getByText('Save Profile'));
    });

    expect(getByText('Name is required')).toBeTruthy();
  });

  it('calls changePassword with both fields and shows a success message', async () => {
    mockedChangePassword.mockResolvedValue({ message: 'ok' });
    const { findByText, getByText, getAllByDisplayValue } = await render(<ProfileScreen />);
    await findByText(/r@communityhq.local/);
    const [currentPasswordInput, newPasswordInput] = getAllByDisplayValue('');

    await act(async () => {
      fireEvent.changeText(currentPasswordInput, 'oldpass123');
    });
    await act(async () => {
      fireEvent.changeText(newPasswordInput, 'newpass123');
    });
    await act(async () => {
      fireEvent.press(getByText('Update Password'));
    });

    expect(mockedChangePassword).toHaveBeenCalledWith('oldpass123', 'newpass123');
    expect(getByText('Password updated.')).toBeTruthy();
  });

  it('shows an error message when changing the password fails', async () => {
    mockedChangePassword.mockRejectedValue(new ApiError('Incorrect current password', 400));
    const { findByText, getByText, getAllByDisplayValue } = await render(<ProfileScreen />);
    await findByText(/r@communityhq.local/);
    const [currentPasswordInput, newPasswordInput] = getAllByDisplayValue('');

    await act(async () => {
      fireEvent.changeText(currentPasswordInput, 'wrongpass');
    });
    await act(async () => {
      fireEvent.changeText(newPasswordInput, 'newpass123');
    });
    await act(async () => {
      fireEvent.press(getByText('Update Password'));
    });

    expect(getByText('Incorrect current password')).toBeTruthy();
  });
});
