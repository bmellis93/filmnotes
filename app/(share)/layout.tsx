export default function ShareLayout({ children }: { children: React.ReactNode }) {
  return <div className="min-h-[100dvh] bg-[var(--surface-0)] text-[var(--text-1)]">{children}</div>;
}