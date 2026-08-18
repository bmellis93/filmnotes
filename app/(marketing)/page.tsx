import Link from "next/link";
import type { Metadata } from "next";
import {
  MessageSquarePlus,
  CheckCircle2,
  FolderKanban,
  Zap,
  ShieldCheck,
  Link2,
  Clapperboard,
  Camera,
  Building2,
} from "lucide-react";
import { buttonVariants } from "@/components/ui/Button";
import { GET_APP_URL } from "@/lib/marketing/links";

export const metadata: Metadata = {
  title: "FilmNotes — Video review and approval, built into HighLevel",
  description:
    "Share cuts, collect timestamped comments, and get client approvals without a single reply-all email thread. FilmNotes runs inside HighLevel.",
};

const steps = [
  {
    title: "Upload & organize",
    body: "Drop your cut into a gallery. FilmNotes transcodes it with Mux and stores the source in secure cloud storage.",
  },
  {
    title: "Share a link",
    body: "Send clients a review link — no account, no app download. They open it and see the video, ready to play.",
  },
  {
    title: "Get feedback that lands on the frame",
    body: "Clients drop comments on the exact timestamp and approve the cut when it's ready. No more \"the part around 2 minutes in.\"",
  },
];

const features = [
  {
    icon: MessageSquarePlus,
    title: "Timestamped comments",
    body: "Every note is pinned to a frame, not buried in an email chain or a text message.",
  },
  {
    icon: CheckCircle2,
    title: "One-click approvals",
    body: "Clients sign off on a cut right from the review link. You always know where a video stands.",
  },
  {
    icon: FolderKanban,
    title: "Galleries, not folders",
    body: "Keep every version, cut, and comment thread for a project organized in one place.",
  },
  {
    icon: Zap,
    title: "Fast, reliable playback",
    body: "Video is delivered through Mux, so clients get smooth playback whether they're on wifi or a phone signal.",
  },
  {
    icon: ShieldCheck,
    title: "Secure by default",
    body: "Review links are scoped to a gallery. Your footage isn't sitting on a public share drive.",
  },
  {
    icon: Link2,
    title: "Built into HighLevel",
    body: "Sign in with the HighLevel account you already run your business on — no separate login to manage.",
  },
];

const audiences = [
  { icon: Clapperboard, label: "Video editors" },
  { icon: Camera, label: "Videographers & photographers" },
  { icon: Building2, label: "Creative & marketing agencies" },
];

export default function HomePage() {
  return (
    <>
      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="mx-auto grid max-w-6xl items-center gap-12 px-4 py-20 sm:px-6 sm:py-28 lg:grid-cols-2 lg:py-32">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full border border-[var(--border-1)] bg-[var(--surface-1)] px-3 py-1 text-xs font-medium text-[var(--text-2)]">
              <span className="h-1.5 w-1.5 rounded-full bg-[var(--cue)]" />
              Built into HighLevel
            </span>

            <h1 className="mt-5 text-4xl font-semibold tracking-tight text-[var(--text-1)] sm:text-5xl">
              Video review, without the reply-all.
            </h1>

            <p className="mt-5 max-w-lg text-lg leading-relaxed text-[var(--text-3)]">
              FilmNotes gives editors and videographers one link clients can open to
              leave timestamped feedback and approve a cut — instead of an email
              thread full of screenshots and timecodes.
            </p>

            <div className="mt-8 flex flex-wrap items-center gap-3">
              <a href={GET_APP_URL} className={buttonVariants({ variant: "primary", className: "px-6 py-3 text-base" })}>
                Get the app
              </a>
              <Link href="/pricing" className={buttonVariants({ variant: "secondary", className: "px-6 py-3 text-base" })}>
                See pricing
              </Link>
            </div>

            <p className="mt-4 text-sm text-[var(--text-muted)]">
              14-day free trial on every plan.
            </p>
          </div>

          <div className="relative">
            <ReviewMock />
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="border-t border-[var(--border-2)] bg-[var(--surface-1)]/40">
        <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
          <h2 className="text-2xl sm:text-3xl">How it works</h2>
          <div className="mt-10 grid gap-8 sm:grid-cols-3">
            {steps.map((step, i) => (
              <div key={step.title}>
                <div className="font-timecode text-sm text-[var(--cue)]">
                  {String(i + 1).padStart(2, "0")}
                </div>
                <h3 className="mt-3">{step.title}</h3>
                <p className="mt-2 text-sm text-[var(--text-3)]">{step.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
        <h2 className="text-2xl sm:text-3xl">Everything a cut needs before it ships</h2>
        <p className="mt-3 max-w-xl text-[var(--text-3)]">
          FilmNotes handles the parts of client review that usually happen
          somewhere else — a shared drive, a text thread, a spreadsheet of notes.
        </p>

        <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((f) => (
            <div
              key={f.title}
              className="rounded-2xl border border-[var(--border-1)] bg-[var(--surface-1)]/40 p-6"
            >
              <div className="grid h-10 w-10 place-items-center rounded-xl bg-[var(--surface-2)]">
                <f.icon className="h-5 w-5 text-[var(--cue)]" />
              </div>
              <h3 className="mt-4">{f.title}</h3>
              <p className="mt-2 text-sm text-[var(--text-3)]">{f.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Audience */}
      <section className="border-t border-[var(--border-2)] bg-[var(--surface-1)]/40">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
          <h2 className="text-center text-xl text-[var(--text-2)]">
            Made for the people who deliver the final cut
          </h2>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-x-10 gap-y-6">
            {audiences.map((a) => (
              <div key={a.label} className="flex items-center gap-2.5 text-[var(--text-2)]">
                <a.icon className="h-5 w-5 text-[var(--text-muted)]" />
                <span className="text-sm font-medium">{a.label}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA banner */}
      <section className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
        <div className="rounded-3xl bg-[var(--ink)] px-8 py-14 text-center sm:px-16">
          <h2 className="text-2xl text-[var(--paper)] sm:text-3xl">
            Ready to get feedback off email and onto the frame?
          </h2>
          <p className="mx-auto mt-3 max-w-md text-[var(--slate)]">
            Start a 14-day free trial and send your first review link today.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <a href={GET_APP_URL} className={buttonVariants({ variant: "primary", className: "px-6 py-3 text-base" })}>
              Get the app
            </a>
            <Link
              href="/pricing"
              className="rounded-lg px-6 py-3 text-base font-semibold text-[var(--paper)] underline decoration-[var(--slate)] underline-offset-4 hover:decoration-[var(--paper)]"
            >
              See pricing
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}

/** Stylized illustration of the review UI — not a literal screenshot. */
function ReviewMock() {
  return (
    <div className="mx-auto max-w-md overflow-hidden rounded-2xl border border-[var(--border-1)] bg-[var(--surface-1)] shadow-2xl shadow-black/10">
      <div className="flex items-center gap-1.5 border-b border-[var(--border-2)] px-4 py-3">
        <span className="h-2.5 w-2.5 rounded-full bg-[var(--border-3)]" />
        <span className="h-2.5 w-2.5 rounded-full bg-[var(--border-3)]" />
        <span className="h-2.5 w-2.5 rounded-full bg-[var(--border-3)]" />
      </div>

      <div className="relative aspect-video bg-[var(--ink)]">
        <div className="absolute inset-0 grid place-items-center">
          <div className="h-14 w-14 rounded-full bg-[var(--paper)]/10" />
        </div>
        <div className="absolute left-[62%] top-[38%] grid h-6 w-6 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-[var(--cue)] text-[10px] font-bold text-[var(--ink)] ring-4 ring-[var(--cue)]/25">
          2
        </div>
        <div className="absolute bottom-3 left-3 right-3 flex items-center gap-2">
          <div className="font-timecode rounded bg-black/50 px-1.5 py-0.5 text-[11px] text-[var(--paper)]">
            00:01:24:07
          </div>
          <div className="h-1 flex-1 rounded-full bg-[var(--paper)]/20">
            <div className="h-1 w-2/5 rounded-full bg-[var(--cue)]" />
          </div>
        </div>
      </div>

      <div className="space-y-3 p-4">
        <div className="flex items-start gap-2.5">
          <div className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-[var(--scope)] text-[10px] font-bold text-[var(--ink)]">
            2
          </div>
          <div className="rounded-xl rounded-tl-sm bg-[var(--surface-2)] px-3 py-2 text-xs text-[var(--text-2)]">
            Can we brighten this shot a touch?
          </div>
        </div>
        <div className="flex items-center gap-2 rounded-xl border border-[var(--border-1)] bg-[var(--surface-0)] px-3 py-2 text-xs text-[var(--text-muted)]">
          Add a comment at 00:01:24
        </div>
        <div className="flex justify-end">
          <span className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--scope)]/15 px-2.5 py-1 text-xs font-medium text-[var(--scope)]">
            <CheckCircle2 className="h-3.5 w-3.5" />
            Approved by client
          </span>
        </div>
      </div>
    </div>
  );
}
