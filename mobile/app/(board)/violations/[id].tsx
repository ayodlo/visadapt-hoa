import { ViolationManageScreen } from '@/screens/shared/ViolationManageScreen';

const STATUS_CHOICES: Parameters<typeof ViolationManageScreen>[0]['statusChoices'] = [
  { value: '', label: 'No change' },
  { value: 'UNDER_REVIEW', label: 'Under Review' },
  { value: 'RESOLVED', label: 'Resolved' },
  { value: 'CLOSED', label: 'Closed' },
];

export default function BoardViolationDetail() {
  return <ViolationManageScreen statusChoices={STATUS_CHOICES} />;
}
