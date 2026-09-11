// app/private/login/page.tsx
//
// Not linked from anywhere public -- this is Ben's own personal entry
// point into the private app. Gated via lib/auth/privateAppGate.ts: the
// first visit needs ?key=<PRIVATE_APP_LOGIN_SECRET>, which the backing API
// route (api/auth/private-login) turns into a long-lived httpOnly cookie --
// after that, the plain /private/login URL (no key visible) keeps working
// from the same browser. Anyone without either gets sent to /pricing
// instead, same as if this route didn't exist. /login (a sibling, public
// page) is a different thing entirely -- the real customer reconnect flow
// for paid/agency orgs.
//
// Signs back into an already-installed state only -- re-issues the session
// directly (see api/auth/private-login) rather than round-tripping through
// GHL's own authorize screen, since that screen only offers "Uninstall"
// once your org/browser is already installed+authenticated, with no
// "continue" option (confirmed live). For an actual re-authenticate or
// reinstall through the marketplace (e.g. after an app update or a scope
// change), use /private/install instead.
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { Logo } from "@/components/brand/Logo";
import { buttonVariants } from "@/components/ui/Button";
import { isValidPrivateKey, PRIVATE_GATE_COOKIE_NAME } from "@/lib/auth/privateAppGate";

export default async function PrivateLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; key?: string }>;
}) {
  const params = await searchParams;
  const next = encodeURIComponent(params?.next ?? "/owner/galleries");

  const cookieStore = await cookies();
  const hasValidKey =
    isValidPrivateKey(params?.key) || isValidPrivateKey(cookieStore.get(PRIVATE_GATE_COOKIE_NAME)?.value);

  if (!hasValidKey) {
    redirect("/pricing");
  }

  const keyParam = params?.key ? `&key=${encodeURIComponent(params.key)}` : "";
  const loginUrl = `/api/auth/private-login?next=${next}${keyParam}`;

  return (
    <main className="min-h-[100dvh] grid place-items-center bg-[var(--surface-0)] text-[var(--text-1)]">
      <div className="w-full max-w-sm rounded-2xl border border-[var(--border-1)] bg-[var(--surface-1)]/40 p-6">
        <Logo className="mb-6" />

        <h1 className="text-lg">Sign in</h1>
        <p className="mt-1 text-sm text-[var(--text-3)]">Connect your CRM account to continue.</p>

        <a className={buttonVariants({ className: "mt-6 w-full" })} href={loginUrl}>
          Connect to your CRM
        </a>
      </div>
    </main>
  );
}
