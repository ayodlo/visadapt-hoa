import DashboardShell from '@/components/DashboardShell';

export default function BoardDashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <DashboardShell>{children}</DashboardShell>;
}
