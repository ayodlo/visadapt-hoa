import { router } from 'expo-router';
import { ScreenContainer } from '@/components/ScreenContainer';
import { ListCard } from '@/components/ListCard';
import { ListRow } from '@/components/ListRow';

const REPORTS: { icon: string; label: string; href: string }[] = [
  { icon: 'build', label: 'Issues Report', href: '/more/reports/issues' },
  { icon: 'payments', label: 'Payments Report', href: '/more/reports/payments' },
  { icon: 'architecture', label: 'Architectural Requests Report', href: '/more/reports/architectural-requests' },
  { icon: 'warning', label: 'Violations Report', href: '/more/reports/violations' },
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
