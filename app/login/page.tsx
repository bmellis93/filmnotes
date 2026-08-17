// app/login/page.tsx
import { Logo } from "@/components/brand/Logo";
import { buttonVariants } from "@/components/ui/Button";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const params = await searchParams;
  const next = encodeURIComponent(params?.next ?? "/owner/galleries");

  return (
    <main className="min-h-[100dvh] grid place-items-center bg-[var(--surface-0)] text-[var(--text-1)]">
      <div className="w-full max-w-sm rounded-2xl border border-[var(--border-1)] bg-[var(--surface-1)]/40 p-6">
        <Logo className="mb-6" />

        <h1 className="text-lg">Sign in</h1>
        <p className="mt-1 text-sm text-[var(--text-3)]">
          Connect your HighLevel account to continue.
        </p>

        <a
          className={buttonVariants({ className: "mt-6 w-full" })}
          href={`/api/auth/oauth/start?next=${next}`}
        >
          Connect HighLevel
        </a>
      </div>
    </main>
  );
}