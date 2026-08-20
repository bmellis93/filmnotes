"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Logo } from "@/components/brand/Logo";
import { buttonVariants } from "@/components/ui/Button";

export default function ReviewerLoginPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function login() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/reviewer-login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.ok) throw new Error(data?.error || "Login failed");
      router.push("/owner/galleries");
      router.refresh();
    } catch (e: any) {
      setError(e?.message || "Login failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="min-h-[100dvh] grid place-items-center bg-[var(--surface-0)] text-[var(--text-1)]">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!busy && password) login();
        }}
        className="w-full max-w-sm rounded-2xl border border-[var(--border-1)] bg-[var(--surface-1)]/40 p-6"
      >
        <Logo className="mb-6" />

        <h1 className="text-lg">Reviewer access</h1>
        <p className="mt-1 text-sm text-[var(--text-3)]">
          Enter the password provided to you to view a demo FilmNotes account.
        </p>

        <input
          type="password"
          autoFocus
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Password"
          className="mt-4 w-full rounded-lg border border-[var(--border-1)] bg-[var(--surface-0)] px-3 py-2 text-sm text-[var(--text-1)] placeholder-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--border-3)]"
        />

        {error && <p className="mt-2 text-sm text-[var(--danger)]">{error}</p>}

        <button
          type="submit"
          disabled={busy || !password}
          className={buttonVariants({ className: "mt-4 w-full" })}
        >
          {busy ? "Signing in…" : "Sign in"}
        </button>
      </form>
    </main>
  );
}
