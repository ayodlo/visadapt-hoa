import { render } from '@testing-library/react-native';
import { StatusBadge } from '@/components/StatusBadge';
import { toneColors } from '@/theme';

describe('StatusBadge', () => {
  it('renders the label converted from SCREAMING_SNAKE_CASE to Title Case', async () => {
    const { getByText } = await render(<StatusBadge label="UNDER_REVIEW" />);
    expect(getByText('Under Review')).toBeTruthy();
  });

  it('applies the default tone colors when none is provided', async () => {
    const { getByText } = await render(<StatusBadge label="OPEN" />);
    const text = getByText('Open');
    expect(text.props.style).toEqual(
      expect.arrayContaining([expect.objectContaining({ color: toneColors.default.text })])
    );
  });

  it('applies the matching tone colors when one is provided', async () => {
    const { getByText } = await render(<StatusBadge label="RESOLVED" tone="success" />);
    const text = getByText('Resolved');
    expect(text.props.style).toEqual(
      expect.arrayContaining([expect.objectContaining({ color: toneColors.success.text })])
    );
  });
});
