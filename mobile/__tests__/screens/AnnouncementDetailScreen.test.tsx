import { render, waitFor } from '@testing-library/react-native';
import { AnnouncementDetailScreen } from '@/screens/shared/AnnouncementDetailScreen';
import { getAnnouncement, markAnnouncementRead } from '@/api/announcements';
import { ApiError } from '@/api/client';
import type { Announcement } from '@/types/announcements';

jest.mock('@/api/announcements');
jest.mock('expo-router', () => ({ useLocalSearchParams: () => ({ id: 'a1' }) }));

const mockedGetAnnouncement = getAnnouncement as jest.Mock;
const mockedMarkRead = markAnnouncementRead as jest.Mock;

function makeAnnouncement(overrides: Partial<Announcement> = {}): Announcement {
  return {
    id: 'a1',
    title: 'Pool closed for maintenance',
    body: 'The pool will be closed Monday through Wednesday.',
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

describe('AnnouncementDetailScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedMarkRead.mockResolvedValue({ read: true });
  });

  it('renders the announcement title, author, and body once loaded', async () => {
    mockedGetAnnouncement.mockResolvedValue({ announcement: makeAnnouncement() });
    const { findByText } = await render(<AnnouncementDetailScreen />);
    expect(await findByText('Pool closed for maintenance')).toBeTruthy();
    expect(await findByText('The pool will be closed Monday through Wednesday.')).toBeTruthy();
    expect(await findByText(/Admin User/)).toBeTruthy();
  });

  it('marks the announcement as read on mount', async () => {
    mockedGetAnnouncement.mockResolvedValue({ announcement: makeAnnouncement() });
    await render(<AnnouncementDetailScreen />);
    await waitFor(() => expect(mockedMarkRead).toHaveBeenCalledWith('a1'));
  });

  it('renders a priority badge for non-normal priority', async () => {
    mockedGetAnnouncement.mockResolvedValue({ announcement: makeAnnouncement({ priority: 'EMERGENCY' }) });
    const { findByText } = await render(<AnnouncementDetailScreen />);
    expect(await findByText('Emergency')).toBeTruthy();
  });

  it('shows an error view with retry on failure', async () => {
    mockedGetAnnouncement.mockRejectedValue(new ApiError('Not found', 404));
    const { findByText } = await render(<AnnouncementDetailScreen />);
    expect(await findByText('Not found')).toBeTruthy();
  });
});
