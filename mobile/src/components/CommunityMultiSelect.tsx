import { StyleSheet, Text } from 'react-native';
import { ListCard } from '@/components/ListCard';
import { ListRow } from '@/components/ListRow';
import { colors } from '@/theme';
import type { Community } from '@/types/community';

interface Props {
  communities: Community[];
  selected: string[];
  onToggle: (communityId: string) => void;
}

// SUPER_ADMIN-only control for assigning an ADMIN/BOARD_MEMBER user to more
// than one community at once. There's no native multi-select in React
// Native, so this is a checkable list — same pattern as ChipSelect but for
// an arbitrary-length selection instead of one-of-many.
export function CommunityMultiSelect({ communities, selected, onToggle }: Props) {
  return (
    <ListCard>
      {communities.map((c) => (
        <ListRow
          key={c.id}
          title={c.name}
          right={selected.includes(c.id) ? <Text style={styles.check}>✓</Text> : undefined}
          onPress={() => onToggle(c.id)}
        />
      ))}
    </ListCard>
  );
}

const styles = StyleSheet.create({
  check: { color: colors.primary, fontSize: 16, fontWeight: '700' },
});
