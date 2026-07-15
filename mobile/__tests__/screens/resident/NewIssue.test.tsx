import { render, fireEvent, act } from '@testing-library/react-native';
import NewIssue from '../../../app/(resident)/issues/new';
import { createIssue } from '@/api/issues';
import { ApiError } from '@/api/client';
import { router } from 'expo-router';

jest.mock('@/api/issues');
jest.mock('expo-router', () => ({ router: { replace: jest.fn() } }));

const mockedCreateIssue = createIssue as jest.Mock;

describe('NewIssue (resident)', () => {
  beforeEach(() => jest.clearAllMocks());

  it('disables submit until the form is valid', async () => {
    const { getByText } = await render(<NewIssue />);
    await act(async () => {
      fireEvent.press(getByText('Submit Issue'));
    });
    expect(mockedCreateIssue).not.toHaveBeenCalled();
  });

  it('submits the issue and navigates to its detail screen', async () => {
    mockedCreateIssue.mockResolvedValue({ issue: { id: 'i1' } });
    const { getByPlaceholderText, getByText } = await render(<NewIssue />);

    await act(async () => {
      fireEvent.changeText(getByPlaceholderText('Short summary'), 'Leaky faucet');
    });
    await act(async () => {
      fireEvent.changeText(getByPlaceholderText('e.g. Building 3, Unit 12'), 'Unit 4');
    });
    await act(async () => {
      fireEvent.changeText(getByPlaceholderText('Describe the issue in detail'), 'Kitchen faucet drips constantly');
    });
    await act(async () => {
      fireEvent.press(getByText('Submit Issue'));
    });

    expect(mockedCreateIssue).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Leaky faucet', location: 'Unit 4', description: 'Kitchen faucet drips constantly' })
    );
    expect(router.replace).toHaveBeenCalledWith('/issues/i1');
  });

  it('shows an error message when submission fails', async () => {
    mockedCreateIssue.mockRejectedValue(new ApiError('Something went wrong', 500));
    const { getByPlaceholderText, getByText } = await render(<NewIssue />);

    await act(async () => {
      fireEvent.changeText(getByPlaceholderText('Short summary'), 'Leaky faucet');
    });
    await act(async () => {
      fireEvent.changeText(getByPlaceholderText('e.g. Building 3, Unit 12'), 'Unit 4');
    });
    await act(async () => {
      fireEvent.changeText(getByPlaceholderText('Describe the issue in detail'), 'Kitchen faucet drips constantly');
    });
    await act(async () => {
      fireEvent.press(getByText('Submit Issue'));
    });

    expect(getByText('Something went wrong')).toBeTruthy();
  });
});
