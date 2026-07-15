import { render, fireEvent, act } from '@testing-library/react-native';
import AdminIssueDetail from '../../../app/(admin)/issues/[id]';
import { updateAdminIssue, listUsers, listVendorOptions } from '@/api/admin';
import { ApiError } from '@/api/client';
import type { AdminIssueDetail as AdminIssueDetailData } from '@/types/admin';

jest.mock('@/api/admin');
jest.mock('expo-router', () => ({ useLocalSearchParams: () => ({ id: 'i1' }) }));

const mockedUpdateAdminIssue = updateAdminIssue as jest.Mock;
const mockedListUsers = listUsers as jest.Mock;
const mockedListVendorOptions = listVendorOptions as jest.Mock;

function makeIssue(overrides: Partial<AdminIssueDetailData> = {}): AdminIssueDetailData {
  return {
    id: 'i1',
    residentId: 'r1',
    propertyId: null,
    vendorId: null,
    assignedToId: null,
    category: 'MAINTENANCE',
    title: 'Leaky faucet',
    description: 'Kitchen faucet drips constantly',
    location: 'Unit 4',
    priority: 'MEDIUM',
    status: 'SUBMITTED',
    preferredContactMethod: 'Email',
    dueDate: null,
    createdAt: '2026-07-14T12:00:00.000Z',
    updatedAt: '2026-07-14T12:00:00.000Z',
    resident: { id: 'r1', firstName: 'Demo', lastName: 'Resident', email: 'r@communityhq.local' },
    assignedTo: null,
    vendor: null,
    comments: [],
    activities: [],
    ...overrides,
  };
}

describe('AdminIssueDetail', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedListUsers.mockResolvedValue([{ id: 'staff1', firstName: 'Staff', lastName: 'Member', email: 's@communityhq.local', role: 'ADMIN', createdAt: '2026-01-01T00:00:00.000Z' }]);
    mockedListVendorOptions.mockResolvedValue({ vendors: [{ id: 'v1', name: 'Acme Plumbing', contactName: null, category: null }] });
  });

  it('reads the current issue via a PATCH with an empty body', async () => {
    mockedUpdateAdminIssue.mockResolvedValue({ issue: makeIssue() });
    const { findByText } = await render(<AdminIssueDetail />);
    expect(await findByText('Leaky faucet')).toBeTruthy();
    expect(mockedUpdateAdminIssue).toHaveBeenCalledWith('i1', {});
  });

  it('saves a status change', async () => {
    // Calls in order: 1) initial "read" via PATCH {}, 2) the real save, 3) reload()'s "read" again.
    mockedUpdateAdminIssue.mockResolvedValueOnce({ issue: makeIssue() });
    mockedUpdateAdminIssue.mockResolvedValueOnce({ issue: makeIssue({ status: 'IN_PROGRESS' }) });
    mockedUpdateAdminIssue.mockResolvedValueOnce({ issue: makeIssue({ status: 'IN_PROGRESS' }) });

    const { findByText, getByText } = await render(<AdminIssueDetail />);
    await findByText('Leaky faucet');

    await act(async () => {
      fireEvent.press(getByText('In Progress'));
    });
    await act(async () => {
      fireEvent.press(getByText('Save'));
    });

    expect(mockedUpdateAdminIssue).toHaveBeenNthCalledWith(2, 'i1', { status: 'IN_PROGRESS' });
    expect(getByText('Saved.')).toBeTruthy();
  });

  it('shows an error message when saving fails', async () => {
    mockedUpdateAdminIssue.mockResolvedValueOnce({ issue: makeIssue() });
    mockedUpdateAdminIssue.mockRejectedValueOnce(new ApiError('Failed to save', 500));

    const { findByText, getByText } = await render(<AdminIssueDetail />);
    await findByText('Leaky faucet');

    await act(async () => {
      fireEvent.press(getByText('In Progress'));
    });
    await act(async () => {
      fireEvent.press(getByText('Save'));
    });

    expect(getByText('Failed to save')).toBeTruthy();
  });
});
