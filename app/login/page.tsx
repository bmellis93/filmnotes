// app/login/page.tsx
//
// The real customer-facing reconnect flow -- requireOwnerContext()
// redirects here whenever a paid or agency org's dashboard is opened
// without a valid session (e.g. the session cookie expired, or the
// dashboard URL was opened directly rather than from inside the CRM
// iframe). Deliberately public and ungated: an existing customer has no
// secret to present, only their CRM login. Distinct from /private/login,
// Ben's own gated entry point into the private app.
//
// We don't know whether a returning visitor's org is a paid or agency
// install until they've picked a location on GHL's own authorize screen,
// so this offers both rather than guessing -- picking the wrong one would
// silently reissue their org's tokens under the wrong app's client
// credentials (see lib/ghl/oauthApps.ts's getAppConfigForOrg).
import { Logo } from "@/components/brand/Logo";
import { buttonVariants } from "@/components/ui/Button";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  const params = await searchParams;
  const next = encodeURIComponent(params?.next ?? "/owner/galleries");
  const noAccess = params?.error === "no_access";

  return (
    <main className="min-h-[100dvh] grid place-items-center bg-[var(--surface-0)] text-[var(--text-1)]">
      <div className="w-full max-w-sm rounded-2xl border border-[var(--border-1)] bg-[var(--surface-1)]/40 p-6">
        <Logo className="mb-6" />

        {noAccess ? (
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
              Connect your CRM account to continue.
            </p>

            <a
              className={buttonVariants({ className: "mt-6 w-full" })}
              href={`/api/auth/oauth/start/paid?next=${next}`}
            >
              Connect to your CRM
            </a>

            <a
              href={`/api/auth/oauth/start/agency?next=${next}`}
              className="mt-3 block text-center text-xs text-[var(--text-3)] hover:text-[var(--text-1)]"
            >
              Signed up through an agency? Connect here instead.
            </a>
          </>
        )}
      </div>
    </main>
  );
}
