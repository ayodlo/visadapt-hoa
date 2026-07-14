import { render, fireEvent, act } from '@testing-library/react-native';
import { AnnouncementsListScreen } from '@/screens/shared/AnnouncementsListScreen';
import { listAnnouncements } from '@/api/announcements';
import { ApiError } from '@/api/client';
import { router } from 'expo-router';
import type { Announcement } from '@/types/announcements';

jest.mock('@/api/announcements');
jest.mock('expo-router', () => ({ router: { push: jest.fn() } }));

const mockedListAnnouncements = listAnnouncements as jest.Mock;

function makeAnnouncement(overrides: Partial<Announcement> = {}): Announcement {
  return {
    id: '1',
    title: 'Pool closed for maintenance',
    body: 'Details',
    priority: 'NORMAL',
    audience: 'ALL_RESIDENTS',
    targetLocation: null,
    isPinned: false,
    publishAt: '2026-07-14T12:00:00.000Z',
    expiresAt: null,
    createdById: 'admin1',
    createdAt: '2026-07-14T12:00:00.000Z',
    updatedAt: '2026-07-14T12:00:00.000Z',
    createdBy: { firstName: 'Admin', lastName: 'User' },
    isRead: false,
    ...overrides,
  };
}

describe('AnnouncementsListScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('shows an empty state when there are no announcements', async () => {
    mockedListAnnouncements.mockResolvedValue({ announcements: [] });
    const { findByText } = await render(<AnnouncementsListScreen />);
    expect(await findByText('No announcements yet')).toBeTruthy();
  });

  it('shows an error view with retry on failure, and retry re-fetches', async () => {
    mockedListAnnouncements.mockRejectedValueOnce(new ApiError('Network error', 500));
    const { findByText, getByText } = await render(<AnnouncementsListScreen />);
    expect(await findByText('Network error')).toBeTruthy();

    mockedListAnnouncements.mockResolvedValueOnce({ announcements: [] });
    await act(async () => {
      fireEvent.press(getByText('Try again'));
    });
    expect(await findByText('No announcements yet')).toBeTruthy();
  });

  it('renders announcements with an unread marker and a priority badge for non-normal priority', async () => {
    mockedListAnnouncements.mockResolvedValue({
      announcements: [
        makeAnnouncement({ id: 'a1', title: 'Read one', isRead: true, priority: 'NORMAL' }),
        makeAnnouncement({ id: 'a2', title: 'Unread urgent one', isRead: false, priority: 'EMERGENCY' }),
      ],
    });
    const { findByText, getByText, queryByText } = await render(<AnnouncementsListScreen />);

    expect(await findByText('Read one')).toBeTruthy();
    expect(getByText('● Unread urgent one')).toBeTruthy();
    expect(getByText('Emergency')).toBeTruthy();
    expect(queryByText('Normal')).toBeNull();
  });

  it('navigates to the announcement detail screen when a row is pressed', async () => {
    mockedListAnnouncements.mockResolvedValue({
      announcements: [makeAnnouncement({ id: 'a1', title: 'Read one', isRead: true })],
    });
    const { findByText, getByText } = await render(<AnnouncementsListScreen />);
    await findByText('Read one');

    fireEvent.press(getByText('Read one'));
    expect(router.push).toHaveBeenCalledWith('/more/announcements/a1');
  });
});
