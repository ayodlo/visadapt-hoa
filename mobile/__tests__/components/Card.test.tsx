import { Text } from 'react-native';
import { render, fireEvent } from '@testing-library/react-native';
import { Card } from '@/components/Card';

describe('Card', () => {
  it('renders its children', async () => {
    const { getByText } = await render(
      <Card>
        <Text>Content</Text>
      </Card>
    );
    expect(getByText('Content')).toBeTruthy();
  });

  it('calls onPress when pressable and pressed', async () => {
    const onPress = jest.fn();
    const { getByText } = await render(
      <Card onPress={onPress}>
        <Text>Content</Text>
      </Card>
    );
    fireEvent.press(getByText('Content'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });
});
