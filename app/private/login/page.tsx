// app/private/login/page.tsx
//
// Not linked from anywhere public -- this is Ben's own personal entry
// point into the private app, bookmarked as
// /private/login?key=<PRIVATE_APP_LOGIN_SECRET>. Anyone hitting this page
// without the right key gets sent to /pricing instead, same as if this
// route didn't exist, rather than seeing a "Sign in" flow that dead-ends
// into a gated OAuth attempt. /login (a sibling, public page) is a
// different thing entirely -- the real customer reconnect flow for paid/
// agency orgs, which requireOwnerContext() redirects to on an expired
// session. The restricted branch below is exempt from the key gate: it
// only ever appears as the *result* of an already-attempted (already-
// keyed) sign-in, and reveals nothing sensitive on its own.
import { redirect } from "next/navigation";
import crypto from "crypto";
import { Logo } from "@/components/brand/Logo";
import { buttonVariants } from "@/components/ui/Button";

function safeEqual(a: string, b: string) {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

export default async function PrivateLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string; key?: string }>;
}) {
  const params = await searchParams;
  const next = encodeURIComponent(params?.next ?? "/owner/galleries");
  const restricted = params?.error === "private_app_restricted";

  const secret = process.env.PRIVATE_APP_LOGIN_SECRET;
  const hasValidKey = Boolean(secret && params?.key && safeEqual(params.key, secret));

  if (!restricted && !hasValidKey) {
    redirect("/pricing");
  }

  const startUrl = `/api/auth/oauth/start?next=${next}&key=${encodeURIComponent(params?.key ?? "")}`;

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
              CRM Marketplace.
            </p>
            <a href="/pricing" className={buttonVariants({ className: "mt-6 w-full" })}>
              See pricing
            </a>
          </>
        ) : (
          <>
            <h1 className="text-lg">Sign in</h1>
            <p className="mt-1 text-sm text-[var(--text-3)]">
              Connect your CRM account to continue.
            </p>

            <a className={buttonVariants({ className: "mt-6 w-full" })} href={startUrl}>
              Connect to your CRM
            </a>
          </>
        )}
      </div>
    </main>
  );
}
