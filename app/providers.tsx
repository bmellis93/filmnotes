// app/providers.tsx
"use client";

import { ThemeProvider } from "next-themes";
import { UploadManagerProvider } from "@/lib/uploads/UploadManagerContext";

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
    >
      {/* Wraps both /owner/* and /embed/* -- embed pages have no shared
          layout of their own, so this is the one place a video upload can
          be started that's guaranteed to keep running across navigation in
          either surface. */}
      <UploadManagerProvider>{children}</UploadManagerProvider>
    </ThemeProvider>
  );
}