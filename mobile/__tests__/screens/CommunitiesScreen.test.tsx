import { render, fireEvent, act } from '@testing-library/react-native';
import { CommunitiesScreen } from '@/screens/shared/CommunitiesScreen';
import { getMyCommunities, createCommunity } from '@/api/community';
import { useAuth } from '@/auth/AuthContext';
import { ApiError } from '@/api/client';

jest.mock('@/api/community');
jest.mock('@/auth/AuthContext', () => ({ useAuth: jest.fn() }));

const mockedGetMyCommunities = getMyCommunities as jest.Mock;
const mockedCreateCommunity = createCommunity as jest.Mock;
const mockedUseAuth = useAuth as jest.Mock;
const mockedSwitchCommunity = jest.fn();

describe('CommunitiesScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedUseAuth.mockReturnValue({
      user: { role: 'ADMIN' },
      activeCommunityId: 'c1',
      switchCommunity: mockedSwitchCommunity,
    });
  });

  it('shows an error view on failure', async () => {
    mockedGetMyCommunities.mockRejectedValue(new ApiError('Network error', 500));
    const { findByText } = await render(<CommunitiesScreen />);
    expect(await findByText('Network error')).toBeTruthy();
  });

  it('marks the active community and lets an ADMIN switch to another one', async () => {
    mockedGetMyCommunities.mockResolvedValue({
      communities: [{ id: 'c1', name: 'Maple Ridge' }, { id: 'c2', name: 'Oak Hollow' }],
      activeCommunityId: 'c1',
    });
    const { findByText, getByText } = await render(<CommunitiesScreen />);
    await findByText('Maple Ridge');
    expect(getByText('Active')).toBeTruthy();

    await act(async () => {
      fireEvent.press(getByText('Oak Hollow'));
    });
    expect(mockedSwitchCommunity).toHaveBeenCalledWith('c2');
  });

  it('does not show "+ Add Community" for a regular ADMIN', async () => {
    mockedGetMyCommunities.mockResolvedValue({ communities: [{ id: 'c1', name: 'Maple Ridge' }], activeCommunityId: 'c1' });
    const { findByText, queryByText } = await render(<CommunitiesScreen />);
    await findByText('Maple Ridge');
    expect(queryByText('+ Add Community')).toBeNull();
  });

  it('lets a SUPER_ADMIN create a new community', async () => {
    mockedUseAuth.mockReturnValue({
      user: { role: 'SUPER_ADMIN' },
      activeCommunityId: 'c1',
      switchCommunity: mockedSwitchCommunity,
    });
    mockedGetMyCommunities.mockResolvedValue({ communities: [{ id: 'c1', name: 'Maple Ridge' }], activeCommunityId: 'c1' });
    mockedCreateCommunity.mockResolvedValue({ id: 'c2', name: 'Oak Hollow' });

    const { findByText, getByText, getByDisplayValue } = await render(<CommunitiesScreen />);
    await findByText('+ Add Community');

    await act(async () => {
      fireEvent.press(getByText('+ Add Community'));
    });
    await act(async () => {
      fireEvent.changeText(getByDisplayValue(''), 'Oak Hollow');
    });
    await act(async () => {
      fireEvent.press(getByText('Create Community'));
    });

    expect(mockedCreateCommunity).toHaveBeenCalledWith('Oak Hollow');
  });
});
