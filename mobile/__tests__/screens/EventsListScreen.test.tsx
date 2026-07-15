import { render, fireEvent } from '@testing-library/react-native';
import { EventsListScreen } from '@/screens/shared/EventsListScreen';
import { listEvents } from '@/api/events';
import { ApiError } from '@/api/client';
import { router } from 'expo-router';
import type { CommunityEvent } from '@/types/events';

jest.mock('@/api/events');
jest.mock('expo-router', () => ({ router: { push: jest.fn() } }));

const mockedListEvents = listEvents as jest.Mock;

function makeEvent(overrides: Partial<CommunityEvent> = {}): CommunityEvent {
  return {
    id: 'e1',
    title: 'Community BBQ',
    description: 'Annual get-together',
    location: 'Clubhouse',
    startAt: '2026-08-01T18:00:00.000Z',
    endAt: null,
    createdById: 'admin1',
    createdAt: '2026-07-14T12:00:00.000Z',
    updatedAt: '2026-07-14T12:00:00.000Z',
    createdBy: { id: 'admin1', firstName: 'Admin', lastName: 'User' },
    ...overrides,
  };
}

describe('EventsListScreen', () => {
  beforeEach(() => jest.clearAllMocks());

  it('shows an empty state when there are no events', async () => {
    mockedListEvents.mockResolvedValue([]);
    const { findByText } = await render(<EventsListScreen />);
    expect(await findByText('No upcoming events')).toBeTruthy();
  });

  it('shows an error view on failure', async () => {
    mockedListEvents.mockRejectedValue(new ApiError('Network error', 500));
    const { findByText } = await render(<EventsListScreen />);
    expect(await findByText('Network error')).toBeTruthy();
  });

  it('includes the location in the subtitle when present', async () => {
    mockedListEvents.mockResolvedValue([makeEvent({ location: 'Clubhouse' })]);
    const { findByText } = await render(<EventsListScreen />);
    expect(await findByText(/Clubhouse/)).toBeTruthy();
  });

  it('navigates to the event detail screen on press', async () => {
    mockedListEvents.mockResolvedValue([makeEvent({ id: 'e1', title: 'Community BBQ' })]);
    const { findByText, getByText } = await render(<EventsListScreen />);
    await findByText('Community BBQ');
    fireEvent.press(getByText('Community BBQ'));
    expect(router.push).toHaveBeenCalledWith('/more/events/e1');
  });
});
