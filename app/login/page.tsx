// app/login/page.tsx
import { Logo } from "@/components/brand/Logo";
import { buttonVariants } from "@/components/ui/Button";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  const params = await searchParams;
  const next = encodeURIComponent(params?.next ?? "/owner/galleries");
  const restricted = params?.error === "private_app_restricted";
  const noAccess = params?.error === "no_access";

  return (
    <main className="min-h-[100dvh] grid place-items-center bg-[var(--surface-0)] text-[var(--text-1)]">
      <div className="w-full max-w-sm rounded-2xl border border-[var(--border-1)] bg-[var(--surface-1)]/40 p-6">
        <Logo className="mb-6" />

        {restricted ? (
          <>
            <h1 className="text-lg">This account isn't available here</h1>
            <p className="mt-1 text-sm text-[var(--text-3)]">
              This sign-in is for existing FilmNotes accounts only. Looking to get
              started? Visit our pricing page to install FilmNotes from the
              HighLevel Marketplace.
            </p>
            <a href="/pricing" className={buttonVariants({ className: "mt-6 w-full" })}>
              See pricing
            </a>
          </>
        ) : noAccess ? (
          <>
            <h1 className="text-lg">You don't have access to this account</h1>
            <p className="mt-1 text-sm text-[var(--text-3)]">
              Your role on this account doesn't include dashboard access. Ask an admin on
              your team to change your role if you think this is a mistake.
            </p>
          </>
        ) : (
          <>
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
          </>
        )}
      </div>
    </main>
  );
}