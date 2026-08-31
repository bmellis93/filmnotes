"use client";

import { useState } from "react";
import { Check, TrendingDown } from "lucide-react";
import { buttonVariants } from "@/components/ui/Button";

export type PricingPlan = {
  name: string;
  price: string;
  storage: string;
  capacity: string;
  overageRate: string;
  blurb: string;
  perk: string | null;
  featured: boolean;
};

export function PricingPlans({
  individualPlans,
  agencyPlans,
  individualCtaHref,
  agencyCtaHref,
}: {
  individualPlans: PricingPlan[];
  agencyPlans: PricingPlan[];
  individualCtaHref: string;
  agencyCtaHref: string;
}) {
  const [audience, setAudience] = useState<"individual" | "agency">("individual");
  const plans = audience === "agency" ? agencyPlans : individualPlans;
  const ctaHref = audience === "agency" ? agencyCtaHref : individualCtaHref;

  return (
    <>
      <div className="mx-auto mb-10 flex w-fit items-center rounded-full border border-[var(--border-1)] bg-[var(--surface-1)]/60 p-1">
        {(
          [
            { key: "individual", label: "For creators" },
            { key: "agency", label: "For agencies" },
          ] as const
        ).map((option) => (
          <button
            key={option.key}
            type="button"
            onClick={() => setAudience(option.key)}
            aria-pressed={audience === option.key}
            className={[
              "rounded-full px-5 py-2 text-sm font-medium transition-colors",
              audience === option.key
                ? "bg-[var(--accent-solid)] text-[var(--accent-solid-fg)]"
                : "text-[var(--text-3)] hover:text-[var(--text-2)]",
            ].join(" ")}
          >
            {option.label}
          </button>
        ))}
      </div>

      {audience === "agency" && (
        <p className="mx-auto -mt-4 mb-8 max-w-lg text-center text-sm text-[var(--text-3)]">
          Discounted per-location pricing for agencies deploying FilmNotes across client
          sub-accounts — works even if you're starting with just one.
        </p>
      )}

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
            <div className="mt-0.5 text-xs text-[var(--text-muted)]">
              {plan.capacity} &middot; {plan.overageRate}
            </div>

            <a
              href={ctaHref}
              className={buttonVariants({
                variant: plan.featured ? "primary" : "secondary",
                className: "mt-6 w-full py-2.5",
              })}
            >
              Start free trial
            </a>

            <ul className="mt-8 flex flex-col gap-3 border-t border-[var(--border-2)] pt-6">
              {plan.perk && (
                <li className="flex items-start gap-2.5 text-sm font-medium text-[var(--cue)]">
                  <TrendingDown className="mt-0.5 h-4 w-4 shrink-0" />
                  {plan.perk}
                </li>
              )}
              {[
                "Unlimited galleries & videos",
                "Unlimited client reviewers",
                "Timestamped comments & approvals",
                "Mux-powered HD/4K playback",
                "Built into your HighLevel account",
              ].map((item) => (
                <li key={item} className="flex items-start gap-2.5 text-sm text-[var(--text-2)]">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-[var(--scope)]" />
                  {item}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </>
  );
}
