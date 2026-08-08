// app/login/page.tsx
export default function LoginPage({
  searchParams,
}: {
  searchParams: { next?: string };
}) {
  const next = encodeURIComponent(searchParams?.next ?? "/owner/galleries");

  return (
    <main className="min-h-[100dvh] grid place-items-center bg-[var(--surface-0)] text-[var(--text-1)]">
      <div className="w-full max-w-sm rounded-2xl border border-[var(--border-1)] bg-[var(--surface-1)]/40 p-6">
        <h1 className="text-lg font-semibold">Sign in</h1>
        <p className="mt-1 text-sm text-[var(--text-3)]">
          Connect your HighLevel account to continue.
        </p>

        <a
          className="mt-6 inline-flex w-full items-center justify-center rounded-xl bg-[var(--accent-solid)] px-4 py-2 text-sm font-semibold text-[var(--accent-solid-fg)] hover:bg-[var(--accent-solid-hover)]"
          href="/api/auth/oauth/start?next=/owner/galleries"
        >
          Connect HighLevel
        </a>
      </div>
    </main>
  );
}