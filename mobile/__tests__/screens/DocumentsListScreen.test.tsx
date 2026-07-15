import { render, fireEvent, waitFor, act } from '@testing-library/react-native';
import { DocumentsListScreen } from '@/screens/shared/DocumentsListScreen';
import { listDocuments } from '@/api/documents';
import { ApiError } from '@/api/client';
import { router } from 'expo-router';
import type { CommunityDocument } from '@/types/documents';

jest.mock('@/api/documents');
jest.mock('expo-router', () => ({ router: { push: jest.fn() } }));

const mockedListDocuments = listDocuments as jest.Mock;

function makeDocument(overrides: Partial<CommunityDocument> = {}): CommunityDocument {
  return {
    id: 'd1',
    title: 'CC&Rs 2026',
    description: null,
    category: 'CC_AND_RS',
    fileUrl: 'https://example.com/ccrs.pdf',
    fileName: 'ccrs.pdf',
    uploadedById: 'admin1',
    createdAt: '2026-07-14T12:00:00.000Z',
    updatedAt: '2026-07-14T12:00:00.000Z',
    uploadedBy: { id: 'admin1', firstName: 'Admin', lastName: 'User' },
    ...overrides,
  };
}

describe('DocumentsListScreen', () => {
  beforeEach(() => jest.clearAllMocks());

  it('shows an empty state when no documents are found', async () => {
    mockedListDocuments.mockResolvedValue({ documents: [], total: 0, page: 1, limit: 20, totalPages: 0 });
    const { findByText } = await render(<DocumentsListScreen />);
    expect(await findByText('No documents found')).toBeTruthy();
  });

  it('shows an error view on failure', async () => {
    mockedListDocuments.mockRejectedValue(new ApiError('Network error', 500));
    const { findByText } = await render(<DocumentsListScreen />);
    expect(await findByText('Network error')).toBeTruthy();
  });

  it('renders documents with category and date in the subtitle', async () => {
    mockedListDocuments.mockResolvedValue({
      documents: [makeDocument({ title: 'CC&Rs 2026', category: 'CC_AND_RS' })],
      total: 1,
      page: 1,
      limit: 20,
      totalPages: 1,
    });
    const { findByText } = await render(<DocumentsListScreen />);
    expect(await findByText('CC&Rs 2026')).toBeTruthy();
    expect(await findByText(/Cc And Rs/)).toBeTruthy();
  });

  it('re-fetches with the search term when typed', async () => {
    mockedListDocuments.mockResolvedValue({ documents: [], total: 0, page: 1, limit: 20, totalPages: 0 });
    const { getByPlaceholderText } = await render(<DocumentsListScreen />);
    await waitFor(() => expect(mockedListDocuments).toHaveBeenCalledWith(undefined));

    await act(async () => {
      fireEvent.changeText(getByPlaceholderText('Search documents...'), 'rules');
    });
    expect(mockedListDocuments).toHaveBeenCalledWith('rules');
  });

  it('navigates to the document detail screen on press', async () => {
    mockedListDocuments.mockResolvedValue({
      documents: [makeDocument({ id: 'd1', title: 'CC&Rs 2026' })],
      total: 1,
      page: 1,
      limit: 20,
      totalPages: 1,
    });
    const { findByText, getByText } = await render(<DocumentsListScreen />);
    await findByText('CC&Rs 2026');
    fireEvent.press(getByText('CC&Rs 2026'));
    expect(router.push).toHaveBeenCalledWith('/more/documents/d1');
  });
});
