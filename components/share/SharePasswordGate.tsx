"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Logo } from "@/components/brand/Logo";
import Button from "@/components/ui/Button";

export default function SharePasswordGate({ token }: { token: string }) {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      const res = await fetch("/api/shares/unlock", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      const data = await res.json().catch(() => null);

      if (!res.ok || !data?.ok) {
        setError(data?.error || "Incorrect password");
        return;
      }

      // Re-runs the Server Component page now that the unlock cookie is set.
      router.refresh();
    } catch {
      setError("Something went wrong. Try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="min-h-[100dvh] grid place-items-center bg-[var(--surface-0)] text-[var(--text-1)] p-4">
      <div className="w-full max-w-sm rounded-2xl border border-[var(--border-1)] bg-[var(--surface-1)]/40 p-6">
        <Logo className="mb-6" />
        <h1 className="text-lg">This link is password protected</h1>
        <p className="mt-1 text-sm text-[var(--text-3)]">
          Enter the password you were given to view this content.
        </p>

        <form onSubmit={handleSubmit} className="mt-6">
          <input
            type="password"
            autoFocus
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password"
            className="w-full rounded-xl border border-[var(--border-1)] bg-[var(--surface-1)] px-4 py-3 text-sm outline-none placeholder:text-[var(--text-muted)] focus:border-[var(--border-3)]"
          />

          {error && (
            <div className="mt-3 rounded-xl border border-[var(--danger)]/30 bg-[var(--danger)]/10 px-4 py-3 text-sm text-[var(--danger)]">
              {error}
            </div>
          )}

          <Button type="submit" disabled={submitting || !password} className="mt-4 w-full">
            {submitting ? "Checking…" : "Unlock"}
          </Button>
        </form>
      </div>
    </main>
  );
}
