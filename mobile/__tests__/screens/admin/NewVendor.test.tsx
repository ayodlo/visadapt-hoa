import { render, fireEvent, act } from '@testing-library/react-native';
import NewVendor from '../../../app/(admin)/more/vendors/new';
import { createVendor } from '@/api/admin';
import { ApiError } from '@/api/client';
import { router } from 'expo-router';

jest.mock('@/api/admin');
jest.mock('expo-router', () => ({ router: { replace: jest.fn() } }));

const mockedCreateVendor = createVendor as jest.Mock;

describe('NewVendor (admin)', () => {
  beforeEach(() => jest.clearAllMocks());

  it('disables submit until a name is entered', async () => {
    const { getByText } = await render(<NewVendor />);
    await act(async () => {
      fireEvent.press(getByText('Add Vendor'));
    });
    expect(mockedCreateVendor).not.toHaveBeenCalled();
  });

  it('creates a vendor and navigates back to the list', async () => {
    mockedCreateVendor.mockResolvedValue({ vendor: { id: 'v1' } });
    const { getByPlaceholderText, getByText } = await render(<NewVendor />);

    await act(async () => {
      fireEvent.changeText(getByPlaceholderText('Vendor company name'), 'Acme Plumbing');
    });
    await act(async () => {
      fireEvent.press(getByText('Add Vendor'));
    });

    expect(mockedCreateVendor).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Acme Plumbing' })
    );
    expect(router.replace).toHaveBeenCalledWith('/more/vendors');
  });

  it('shows an error message when creation fails', async () => {
    mockedCreateVendor.mockRejectedValue(new ApiError('Something went wrong', 500));
    const { getByPlaceholderText, getByText } = await render(<NewVendor />);

    await act(async () => {
      fireEvent.changeText(getByPlaceholderText('Vendor company name'), 'Acme Plumbing');
    });
    await act(async () => {
      fireEvent.press(getByText('Add Vendor'));
    });

    expect(getByText('Something went wrong')).toBeTruthy();
  });
});
