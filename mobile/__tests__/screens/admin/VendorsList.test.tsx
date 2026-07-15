import { render } from '@testing-library/react-native';
import VendorsList from '../../../app/(admin)/more/vendors/index';
import { listVendorOptions } from '@/api/admin';
import { ApiError } from '@/api/client';

jest.mock('@/api/admin');
jest.mock('expo-router', () => ({
  router: { push: jest.fn() },
  Stack: { Screen: () => null },
}));

const mockedListVendorOptions = listVendorOptions as jest.Mock;

describe('VendorsList (admin)', () => {
  beforeEach(() => jest.clearAllMocks());

  it('shows an empty state when there are no vendors', async () => {
    mockedListVendorOptions.mockResolvedValue({ vendors: [] });
    const { findByText } = await render(<VendorsList />);
    expect(await findByText(/No vendors yet/)).toBeTruthy();
  });

  it('shows an error view on failure', async () => {
    mockedListVendorOptions.mockRejectedValue(new ApiError('Network error', 500));
    const { findByText } = await render(<VendorsList />);
    expect(await findByText('Network error')).toBeTruthy();
  });

  it('renders a vendor with its contact name as the subtitle', async () => {
    mockedListVendorOptions.mockResolvedValue({
      vendors: [{ id: 'v1', name: 'Acme Plumbing', contactName: 'Jane Doe', category: 'Plumbing' }],
    });
    const { findByText } = await render(<VendorsList />);
    expect(await findByText('Acme Plumbing')).toBeTruthy();
    expect(await findByText('Jane Doe')).toBeTruthy();
  });
});
