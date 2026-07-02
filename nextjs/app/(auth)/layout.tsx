import ThemeToggle from '@/components/ThemeToggle';

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <div className="fixed top-4 right-4 z-10">
        <ThemeToggle />
      </div>
      {children}
    </>
  );
}
