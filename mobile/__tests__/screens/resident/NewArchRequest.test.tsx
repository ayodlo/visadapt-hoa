import { render, fireEvent, act } from '@testing-library/react-native';
import NewArchRequest from '../../../app/(resident)/more/architectural-requests/new';
import { createArchRequest } from '@/api/architecturalRequests';
import { ApiError } from '@/api/client';
import { router } from 'expo-router';

jest.mock('@/api/architecturalRequests');
jest.mock('expo-router', () => ({ router: { replace: jest.fn() } }));

const mockedCreateArchRequest = createArchRequest as jest.Mock;

describe('NewArchRequest (resident)', () => {
  beforeEach(() => jest.clearAllMocks());

  it('disables both submit buttons until the description is long enough', async () => {
    const { getByText } = await render(<NewArchRequest />);
    await act(async () => {
      fireEvent.press(getByText('Submit for Review'));
    });
    expect(mockedCreateArchRequest).not.toHaveBeenCalled();
  });

  it('saves as a draft (submitNow: false)', async () => {
    mockedCreateArchRequest.mockResolvedValue({ request: { id: 'ar1' } });
    const { getByPlaceholderText, getByText } = await render(<NewArchRequest />);

    await act(async () => {
      fireEvent.changeText(
        getByPlaceholderText("Describe the change you'd like to make (min 20 characters)"),
        'A new six foot wooden fence'
      );
    });
    await act(async () => {
      fireEvent.press(getByText('Save as Draft'));
    });

    expect(mockedCreateArchRequest).toHaveBeenCalledWith(
      expect.objectContaining({ description: 'A new six foot wooden fence', submitNow: false })
    );
    expect(router.replace).toHaveBeenCalledWith('/more/architectural-requests/ar1');
  });

  it('submits for review (submitNow: true)', async () => {
    mockedCreateArchRequest.mockResolvedValue({ request: { id: 'ar1' } });
    const { getByPlaceholderText, getByText } = await render(<NewArchRequest />);

    await act(async () => {
      fireEvent.changeText(
        getByPlaceholderText("Describe the change you'd like to make (min 20 characters)"),
        'A new six foot wooden fence'
      );
    });
    await act(async () => {
      fireEvent.press(getByText('Submit for Review'));
    });

    expect(mockedCreateArchRequest).toHaveBeenCalledWith(
      expect.objectContaining({ submitNow: true })
    );
  });

  it('shows an error message when submission fails', async () => {
    mockedCreateArchRequest.mockRejectedValue(new ApiError('Something went wrong', 500));
    const { getByPlaceholderText, getByText } = await render(<NewArchRequest />);

    await act(async () => {
      fireEvent.changeText(
        getByPlaceholderText("Describe the change you'd like to make (min 20 characters)"),
        'A new six foot wooden fence'
      );
    });
    await act(async () => {
      fireEvent.press(getByText('Submit for Review'));
    });

    expect(getByText('Something went wrong')).toBeTruthy();
  });
});
