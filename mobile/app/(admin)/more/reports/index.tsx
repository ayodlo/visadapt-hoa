import { router } from 'expo-router';
import { ScreenContainer } from '@/components/ScreenContainer';
import { ListCard } from '@/components/ListCard';
import { ListRow } from '@/components/ListRow';

const REPORTS: { icon: string; label: string; href: string }[] = [
  { icon: '🔨', label: 'Issues Report', href: '/more/reports/issues' },
  { icon: '💰', label: 'Payments Report', href: '/more/reports/payments' },
  { icon: '🏗️', label: 'Architectural Requests Report', href: '/more/reports/architectural-requests' },
  { icon: '⚠️', label: 'Violations Report', href: '/more/reports/violations' },
];

export default function ReportsMenu() {
  return (
    <ScreenContainer>
      <ListCard>
        {REPORTS.map((r) => (
          <ListRow key={r.href} title={`${r.icon}  ${r.label}`} onPress={() => router.push(r.href)} />
        ))}
      </ListCard>
    </ScreenContainer>
  );
}
