import { render } from '@testing-library/react-native';
import { EmptyState } from '@/components/EmptyState';

describe('EmptyState', () => {
  it('renders the message', async () => {
    const { getByText } = await render(<EmptyState message="No issues yet" />);
    expect(getByText('No issues yet')).toBeTruthy();
  });

  it('renders a default icon when none is provided', async () => {
    const { getByText } = await render(<EmptyState message="Nothing here" />);
    expect(getByText('📭')).toBeTruthy();
  });

  it('renders a custom icon when provided', async () => {
    const { getByText } = await render(<EmptyState icon="📢" message="No announcements yet" />);
    expect(getByText('📢')).toBeTruthy();
  });
});
