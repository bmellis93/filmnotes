// app/video-review/layout.tsx
import type { ReactNode } from "react";

export default function Layout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-[var(--ink)] text-[var(--paper)]">
      {children}
    </div>
  );
}