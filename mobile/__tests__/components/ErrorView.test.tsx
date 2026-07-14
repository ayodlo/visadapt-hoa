import { render, fireEvent } from '@testing-library/react-native';
import { ErrorView } from '@/components/ErrorView';

describe('ErrorView', () => {
  it('renders a default message when none is provided', async () => {
    const { getByText } = await render(<ErrorView />);
    expect(getByText('Something went wrong.')).toBeTruthy();
  });

  it('renders a custom message when provided', async () => {
    const { getByText } = await render(<ErrorView message="Network error" />);
    expect(getByText('Network error')).toBeTruthy();
  });

  it('does not render a retry button when onRetry is not provided', async () => {
    const { queryByText } = await render(<ErrorView message="Network error" />);
    expect(queryByText('Try again')).toBeNull();
  });

  it('renders a retry button and calls onRetry when pressed', async () => {
    const onRetry = jest.fn();
    const { getByText } = await render(<ErrorView message="Network error" onRetry={onRetry} />);
    fireEvent.press(getByText('Try again'));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });
});
