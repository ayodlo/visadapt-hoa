import { ViolationManageScreen } from '@/screens/shared/ViolationManageScreen';

const STATUS_CHOICES: Parameters<typeof ViolationManageScreen>[0]['statusChoices'] = [
  { value: '', label: 'No change' },
  { value: 'DRAFT', label: 'Draft' },
  { value: 'NOTICE_SENT', label: 'Notice Sent' },
  { value: 'RESIDENT_RESPONDED', label: 'Resident Responded' },
  { value: 'UNDER_REVIEW', label: 'Under Review' },
  { value: 'ESCALATED', label: 'Escalated' },
  { value: 'RESOLVED', label: 'Resolved' },
  { value: 'CLOSED', label: 'Closed' },
];

export default function AdminViolationDetail() {
  return <ViolationManageScreen statusChoices={STATUS_CHOICES} />;
}
