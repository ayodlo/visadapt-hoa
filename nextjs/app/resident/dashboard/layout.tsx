import DashboardShell from '@/components/DashboardShell';

export default function ResidentDashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <DashboardShell>{children}</DashboardShell>;
}
