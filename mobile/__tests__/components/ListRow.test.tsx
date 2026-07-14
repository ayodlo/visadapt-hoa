import { Text } from 'react-native';
import { render, fireEvent } from '@testing-library/react-native';
import { ListRow } from '@/components/ListRow';

describe('ListRow', () => {
  it('renders the title', async () => {
    const { getByText } = await render(<ListRow title="Pool closed" />);
    expect(getByText('Pool closed')).toBeTruthy();
  });

  it('renders a subtitle when provided', async () => {
    const { getByText } = await render(<ListRow title="Pool closed" subtitle="Jul 14, 2026" />);
    expect(getByText('Jul 14, 2026')).toBeTruthy();
  });

  it('does not render a subtitle when none is provided', async () => {
    const { queryByText } = await render(<ListRow title="Pool closed" />);
    expect(queryByText('Jul 14, 2026')).toBeNull();
  });

  it('renders the right-side content when provided', async () => {
    const { getByText } = await render(<ListRow title="Pool closed" right={<Text>Badge</Text>} />);
    expect(getByText('Badge')).toBeTruthy();
  });

  it('shows a chevron only when onPress is provided', async () => {
    const withPress = await render(<ListRow title="A" onPress={() => {}} />);
    expect(withPress.getByText('›')).toBeTruthy();

    const withoutPress = await render(<ListRow title="B" />);
    expect(withoutPress.queryByText('›')).toBeNull();
  });

  it('calls onPress when pressed', async () => {
    const onPress = jest.fn();
    const { getByText } = await render(<ListRow title="Pool closed" onPress={onPress} />);
    fireEvent.press(getByText('Pool closed'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });
});
