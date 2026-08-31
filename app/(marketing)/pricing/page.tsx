import type { Metadata } from "next";
import { buttonVariants } from "@/components/ui/Button";
import { GET_APP_URL, GET_AGENCY_APP_URL } from "@/lib/marketing/links";
import { PricingPlans, type PricingPlan } from "@/components/marketing/PricingPlans";

export const metadata: Metadata = {
  title: "Pricing — FilmNotes",
  description:
    "Simple, storage-based pricing for FilmNotes. Every plan includes unlimited galleries, timestamped comments, and client approvals.",
};

const individualPlans: PricingPlan[] = [
  {
    name: "Starter",
    price: "$19",
    storage: "100 GB storage",
    capacity: "~6-7 full projects live at once",
    overageRate: "$0.12/GB over",
    blurb: "For solo editors keeping a handful of active projects at once.",
    perk: null,
    featured: false,
  },
  {
    name: "Studio",
    price: "$59",
    storage: "500 GB storage",
    capacity: "~30-35 full projects live at once",
    overageRate: "$0.12/GB over",
    blurb: "For a busy editing or production schedule with several clients in flight.",
    perk: null,
    featured: true,
  },
  {
    name: "Pro",
    price: "$129",
    storage: "1 TB storage",
    capacity: "~65-70 full projects live at once",
    overageRate: "$0.09/GB over",
    blurb: "For high-volume shops delivering long-form or high-resolution footage.",
    perk: "25% lower overage rate than Starter & Studio",
    featured: false,
  },
];

// Same storage tiers as individualPlans, priced lower -- sold through the
// Agency-only-distribution Marketplace app (see the pricing discussion this
// was built from). Overage rates are intentionally left the same as the
// individual tiers rather than discounted too.
const agencyPlans: PricingPlan[] = [
  {
    name: "Starter",
    price: "$15",
    storage: "100 GB storage",
    capacity: "~6-7 full projects live at once",
    overageRate: "$0.12/GB over",
    blurb: "Agency pricing for a single client sub-account, with room to add more anytime.",
    perk: null,
    featured: false,
  },
  {
    name: "Studio",
    price: "$47",
    storage: "500 GB storage",
    capacity: "~30-35 full projects live at once",
    overageRate: "$0.12/GB over",
    blurb: "Agency pricing for a busier sub-account managing several client projects.",
    perk: null,
    featured: true,
  },
  {
    name: "Pro",
    price: "$99",
    storage: "1 TB storage",
    capacity: "~65-70 full projects live at once",
    overageRate: "$0.09/GB over",
    blurb: "Agency pricing for high-volume sub-accounts delivering long-form or 4K footage.",
    perk: "25% lower overage rate than Starter & Studio",
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
    a: "You're not cut off — additional storage beyond your plan is billed automatically each month along with your subscription: $0.12/GB on Starter and Studio, $0.09/GB on Pro.",
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
          Every plan includes the same review workflow. Tiers scale with how
          much footage you keep live at once — and Pro gets a lower overage
          rate too.
        </p>
        <p className="mt-3 text-sm font-medium text-[var(--cue)]">
          Every plan starts with a 14-day free trial. A card is required to start.
        </p>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
        <PricingPlans
          individualPlans={individualPlans}
          agencyPlans={agencyPlans}
          individualCtaHref={GET_APP_URL}
          agencyCtaHref={GET_AGENCY_APP_URL}
        />

        <p className="mt-4 text-center text-xs text-[var(--text-muted)]">
          Capacity estimates assume a mix of full-length masters and highlight reels —
          actual footage varies by project.
        </p>

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
          <span className="font-medium text-[var(--text-2)]">$0.12/GB</span> on Starter and Studio,{" "}
          <span className="font-medium text-[var(--text-2)]">$0.09/GB</span> on Pro, charged monthly.
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
