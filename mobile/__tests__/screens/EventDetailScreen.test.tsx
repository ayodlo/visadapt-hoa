import { render } from '@testing-library/react-native';
import { EventDetailScreen } from '@/screens/shared/EventDetailScreen';
import { listEvents } from '@/api/events';
import type { CommunityEvent } from '@/types/events';

jest.mock('@/api/events');
jest.mock('expo-router', () => ({ useLocalSearchParams: () => ({ id: 'e1' }) }));

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

describe('EventDetailScreen', () => {
  beforeEach(() => jest.clearAllMocks());

  it('finds and renders the matching event from the list', async () => {
    mockedListEvents.mockResolvedValue([makeEvent(), makeEvent({ id: 'e2', title: 'Other event' })]);
    const { findByText } = await render(<EventDetailScreen />);
    expect(await findByText('Community BBQ')).toBeTruthy();
    expect(await findByText('📍 Clubhouse')).toBeTruthy();
  });

  it('shows "Event not found" when no event matches the id', async () => {
    mockedListEvents.mockResolvedValue([makeEvent({ id: 'different-id' })]);
    const { findByText } = await render(<EventDetailScreen />);
    expect(await findByText('Event not found.')).toBeTruthy();
  });

  it('omits the location line when the event has none', async () => {
    mockedListEvents.mockResolvedValue([makeEvent({ location: null })]);
    const { findByText, queryByText } = await render(<EventDetailScreen />);
    await findByText('Community BBQ');
    expect(queryByText(/📍/)).toBeNull();
  });
});
