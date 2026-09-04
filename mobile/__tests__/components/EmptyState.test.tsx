import { render } from '@testing-library/react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { EmptyState } from '@/components/EmptyState';

/**
 * The icon renders as a glyph from the icon font, so assert on the glyph the
 * requested name maps to rather than the name itself — that is what a user
 * actually sees, and it fails if the name stops resolving.
 */
const glyph = (name: keyof typeof MaterialIcons.glyphMap) => {
  const code = MaterialIcons.glyphMap[name];
  return typeof code === 'number' ? String.fromCodePoint(code) : code;
};

describe('EmptyState', () => {
  it('renders the message', async () => {
    const { getByText } = await render(<EmptyState message="No issues yet" />);
    expect(getByText('No issues yet')).toBeTruthy();
  });

  it('renders a default icon when none is provided', async () => {
    const { getByText } = await render(<EmptyState message="Nothing here" />);
    expect(getByText(glyph('inbox'))).toBeTruthy();
  });

  it('renders a custom icon when provided', async () => {
    const { getByText } = await render(
      <EmptyState icon="campaign" message="No announcements yet" />
    );
    expect(getByText(glyph('campaign'))).toBeTruthy();
  });
});
