import type { Metadata } from "next";
import { Check } from "lucide-react";
import { buttonVariants } from "@/components/ui/Button";
import { GET_APP_URL } from "@/lib/marketing/links";

export const metadata: Metadata = {
  title: "Pricing — FilmNotes",
  description:
    "Simple, storage-based pricing for FilmNotes. Every plan includes unlimited galleries, timestamped comments, and client approvals.",
};

const includedEverywhere = [
  "Unlimited galleries & videos",
  "Unlimited client reviewers",
  "Timestamped comments & approvals",
  "Mux-powered HD/4K playback",
  "Built into your HighLevel account",
];

const plans = [
  {
    name: "Starter",
    price: "$19",
    storage: "100 GB storage",
    blurb: "For solo editors keeping a handful of active projects at once.",
    featured: false,
  },
  {
    name: "Studio",
    price: "$59",
    storage: "500 GB storage",
    blurb: "For a busy editing or production schedule with several clients in flight.",
    featured: true,
  },
  {
    name: "Pro",
    price: "$129",
    storage: "1 TB storage",
    blurb: "For high-volume shops delivering long-form or high-resolution footage.",
    featured: false,
  },
];

const faqs = [
  {
    q: "What happens after the 14-day trial?",
    a: "Your card is charged for the plan you selected once the trial ends. You can cancel any time before then and you won't be charged.",
  },
  {
    q: "What counts against my storage?",
    a: "The source files you upload into galleries. Mux-hosted streaming renditions and comment/approval data don't count against your limit.",
  },
  {
    q: "What happens if I go over my plan's storage?",
    a: "You're not cut off — additional storage beyond your plan is billed automatically at $0.12/GB, charged monthly along with your subscription.",
  },
  {
    q: "Can I change plans later?",
    a: "Yes, upgrade or downgrade any time from your HighLevel account. Changes take effect on your next billing cycle.",
  },
  {
    q: "Do my clients need a FilmNotes account?",
    a: "No. Clients open a review link you share and can comment or approve without signing up for anything.",
  },
];

export default function PricingPage() {
  return (
    <>
      <section className="mx-auto max-w-4xl px-4 pb-4 pt-20 text-center sm:px-6">
        <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">
          Pricing that scales with your footage
        </h1>
        <p className="mx-auto mt-4 max-w-xl text-lg text-[var(--text-3)]">
          Every plan includes the same review workflow. The only thing that
          changes is how much storage you need.
        </p>
        <p className="mt-3 text-sm font-medium text-[var(--cue)]">
          Every plan starts with a 14-day free trial. A card is required to start.
        </p>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
        <div className="grid gap-6 lg:grid-cols-3">
          {plans.map((plan) => (
            <div
              key={plan.name}
              className={[
                "flex flex-col rounded-3xl border p-8",
                plan.featured
                  ? "border-[var(--cue)] bg-[var(--surface-1)] shadow-lg shadow-[var(--cue)]/10"
                  : "border-[var(--border-1)] bg-[var(--surface-1)]/40",
              ].join(" ")}
            >
              {plan.featured && (
                <span className="mb-4 inline-flex w-fit items-center rounded-full bg-[var(--cue)]/15 px-3 py-1 text-xs font-semibold text-[var(--cue)]">
                  Most popular
                </span>
              )}

              <h2 className="text-xl">{plan.name}</h2>
              <p className="mt-2 text-sm text-[var(--text-3)]">{plan.blurb}</p>

              <div className="mt-6 flex items-baseline gap-1">
                <span className="text-4xl font-semibold tracking-tight">{plan.price}</span>
                <span className="text-sm text-[var(--text-muted)]">/mo</span>
              </div>
              <div className="mt-1 text-sm font-medium text-[var(--text-2)]">{plan.storage}</div>

              <a
                href={GET_APP_URL}
                className={buttonVariants({
                  variant: plan.featured ? "primary" : "secondary",
                  className: "mt-6 w-full py-2.5",
                })}
              >
                Start free trial
              </a>

              <ul className="mt-8 flex flex-col gap-3 border-t border-[var(--border-2)] pt-6">
                {includedEverywhere.map((item) => (
                  <li key={item} className="flex items-start gap-2.5 text-sm text-[var(--text-2)]">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-[var(--scope)]" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Custom tier */}
        <div className="mt-6 flex flex-col items-center justify-between gap-4 rounded-3xl border border-[var(--border-1)] bg-[var(--surface-1)]/40 p-8 sm:flex-row">
          <div>
            <h2 className="text-lg">Need more than 1 TB?</h2>
            <p className="mt-1 text-sm text-[var(--text-3)]">
              Custom plans are available for high-volume studios and agencies with negotiated storage and pricing.
            </p>
          </div>
          <a
            href="mailto:support@filmnotes.app?subject=Custom%20FilmNotes%20plan"
            className={buttonVariants({ variant: "secondary", className: "shrink-0 px-6 py-2.5" })}
          >
            Contact us
          </a>
        </div>

        <p className="mt-8 text-center text-sm text-[var(--text-muted)]">
          Storage beyond your plan's limit is billed at{" "}
          <span className="font-medium text-[var(--text-2)]">$0.12/GB</span>, charged monthly.
        </p>
      </section>

      {/* FAQ */}
      <section className="border-t border-[var(--border-2)] bg-[var(--surface-1)]/40">
        <div className="mx-auto max-w-3xl px-4 py-20 sm:px-6">
          <h2 className="text-2xl sm:text-3xl">Frequently asked questions</h2>
          <div className="mt-8 flex flex-col divide-y divide-[var(--border-2)]">
            {faqs.map((faq) => (
              <div key={faq.q} className="py-5">
                <h3 className="text-base">{faq.q}</h3>
                <p className="mt-2 text-sm text-[var(--text-3)]">{faq.a}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
