import { Linking } from 'react-native';
import { render, fireEvent, act } from '@testing-library/react-native';
import { DocumentDetailScreen } from '@/screens/shared/DocumentDetailScreen';
import { getDocument, getDocumentDownloadUrl } from '@/api/documents';
import { ApiError } from '@/api/client';
import type { CommunityDocument } from '@/types/documents';

jest.mock('@/api/documents');
jest.mock('expo-router', () => ({ useLocalSearchParams: () => ({ id: 'd1' }) }));

const mockedGetDocument = getDocument as jest.Mock;
const mockedGetDownloadUrl = getDocumentDownloadUrl as jest.Mock;

function makeDocument(overrides: Partial<CommunityDocument> = {}): CommunityDocument {
  return {
    id: 'd1',
    title: 'CC&Rs 2026',
    description: 'Governing rules',
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

describe('DocumentDetailScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(Linking, 'openURL').mockResolvedValue(true);
  });

  it('renders the document title, category, and uploader', async () => {
    mockedGetDocument.mockResolvedValue(makeDocument());
    const { findByText } = await render(<DocumentDetailScreen />);
    expect(await findByText('CC&Rs 2026')).toBeTruthy();
    expect(await findByText(/Admin User/)).toBeTruthy();
  });

  it('opens the download URL when "Open Document" is pressed', async () => {
    mockedGetDocument.mockResolvedValue(makeDocument());
    mockedGetDownloadUrl.mockResolvedValue({ url: 'https://example.com/signed-url', fileName: 'ccrs.pdf' });
    const { findByText, getByText } = await render(<DocumentDetailScreen />);
    await findByText('CC&Rs 2026');

    await act(async () => {
      fireEvent.press(getByText('Open Document'));
    });

    expect(Linking.openURL).toHaveBeenCalledWith('https://example.com/signed-url');
  });

  it('shows an error message when opening the document fails', async () => {
    mockedGetDocument.mockResolvedValue(makeDocument());
    mockedGetDownloadUrl.mockRejectedValue(new ApiError('Could not generate link', 500));
    const { findByText, getByText } = await render(<DocumentDetailScreen />);
    await findByText('CC&Rs 2026');

    await act(async () => {
      fireEvent.press(getByText('Open Document'));
    });

    expect(await findByText('Could not generate link')).toBeTruthy();
  });
});
