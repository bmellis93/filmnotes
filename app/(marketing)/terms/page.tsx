import type { Metadata } from "next";
import LegalDoc from "@/components/marketing/LegalDoc";

export const metadata: Metadata = {
  title: "Terms of Service — FilmNotes",
  description: "The terms that govern your use of FilmNotes.",
};

const UPDATED = "August 17, 2026";

export default function TermsPage() {
  return (
    <LegalDoc title="Terms of Service" updated={UPDATED}>
      <p>
        These Terms of Service (&ldquo;Terms&rdquo;) are a legal agreement between you
        (&ldquo;you,&rdquo; the individual or business using FilmNotes) and Renowned
        Media, LLC (&ldquo;FilmNotes,&rdquo; &ldquo;we,&rdquo; &ldquo;us,&rdquo; or
        &ldquo;our&rdquo;). By connecting your HighLevel account to FilmNotes or
        otherwise using the service, you agree to these Terms. If you don&rsquo;t
        agree, don&rsquo;t use FilmNotes.
      </p>

      <h2>1. The service</h2>
      <p>
        FilmNotes is a video review and approval tool. Account holders
        (&ldquo;owners&rdquo;) upload video, organize it into galleries, and share
        review links so their clients (&ldquo;reviewers&rdquo;) can leave
        timestamped comments and approve cuts. FilmNotes is installed and
        accessed through your HighLevel account, which is used for
        authentication, billing, and certain client messaging.
      </p>

      <h2>2. Accounts and eligibility</h2>
      <p>
        You must have an active HighLevel account in good standing to use
        FilmNotes, and you must be authorized to act on behalf of the
        HighLevel location you connect. You&rsquo;re responsible for activity
        that happens under your account, including activity by anyone you
        invite as a team member.
      </p>

      <h2>3. Free trial</h2>
      <p>
        New plans include a 14-day free trial. A payment method is required
        to start a trial. If you don&rsquo;t cancel before the trial ends,
        you&rsquo;ll automatically be charged for the plan you selected, and
        billing continues on that cycle until you cancel.
      </p>

      <h2>4. Plans, billing, and storage overage</h2>
      <p>
        FilmNotes plans are billed monthly through HighLevel and are
        differentiated primarily by included storage. If your account&rsquo;s
        stored video exceeds your plan&rsquo;s included storage, we&rsquo;ll
        automatically bill the excess at $0.12 per GB as part of your regular
        billing cycle, rather than blocking uploads or deleting content.
        Current plan pricing and included storage are listed on our{" "}
        <a href="/pricing">pricing page</a>, which may change from time to
        time; we&rsquo;ll give you reasonable notice before a price change
        applies to your account.
      </p>
      <p>
        Custom plans negotiated directly with us are governed by these Terms
        together with whatever storage and pricing terms we agree to in
        writing.
      </p>

      <h2>5. Cancellation and refunds</h2>
      <p>
        You can cancel at any time from your HighLevel account. Cancellation
        takes effect at the end of your current billing period, and fees
        already charged are non-refundable except where required by law.
      </p>

      <h2>6. Your content</h2>
      <p>
        You retain ownership of the video, images, comments, and other
        material you or your reviewers upload to FilmNotes
        (&ldquo;Content&rdquo;). By uploading Content, you grant us a
        limited license to host, process, transcode, store, and transmit it
        solely to provide FilmNotes to you — for example, delivering your
        video through our streaming provider or generating a review link.
        We don&rsquo;t claim ownership of your Content and won&rsquo;t use it
        for anything other than operating and improving the service, unless
        you tell us otherwise.
      </p>
      <p>
        You&rsquo;re responsible for having the rights necessary to upload
        and share the Content you put into FilmNotes, and for what you and
        your reviewers say in comments and approvals.
      </p>

      <h2>7. Reviewer access</h2>
      <p>
        Review links let the people you share them with view a gallery and
        leave comments or approvals without creating a FilmNotes account.
        You&rsquo;re responsible for who you share a review link with — anyone
        with the link can access what it points to, so treat it like you
        would any other private link to your work.
      </p>

      <h2>8. Acceptable use</h2>
      <p>You agree not to use FilmNotes to:</p>
      <ul>
        <li>Upload content you don&rsquo;t have the rights to share</li>
        <li>Upload unlawful, infringing, or abusive material</li>
        <li>Attempt to access another account or organization&rsquo;s galleries without authorization</li>
        <li>Interfere with or disrupt the service, or attempt to bypass its security or storage limits</li>
        <li>Use the service to build a competing product</li>
      </ul>
      <p>
        We can suspend or terminate access for accounts that violate this
        section.
      </p>

      <h2>9. Service availability</h2>
      <p>
        We work to keep FilmNotes available and your video playable, but we
        don&rsquo;t guarantee the service will be uninterrupted or
        error-free. Planned maintenance or issues with providers we rely on
        (such as our video or storage infrastructure) can affect
        availability from time to time.
      </p>

      <h2>10. Termination</h2>
      <p>
        You can stop using FilmNotes at any time by canceling your plan and
        disconnecting your HighLevel account. We may suspend or terminate
        your access if you violate these Terms, if required by law, or if
        your subscription lapses. On termination, we may delete your stored
        Content after a reasonable period; export anything you need before
        canceling.
      </p>

      <h2>11. Disclaimers</h2>
      <p>
        FilmNotes is provided &ldquo;as is&rdquo; without warranties of any
        kind, express or implied, including implied warranties of
        merchantability, fitness for a particular purpose, and
        non-infringement. We don&rsquo;t warrant that the service will meet
        your requirements or be error-free.
      </p>

      <h2>12. Limitation of liability</h2>
      <p>
        To the maximum extent permitted by law, Renowned Media, LLC won&rsquo;t
        be liable for any indirect, incidental, special, consequential, or
        punitive damages, or for lost profits or lost data, arising from your
        use of FilmNotes. Our total liability for any claim relating to the
        service is limited to the amount you paid us in the three months
        before the claim arose.
      </p>

      <h2>13. Changes to these terms</h2>
      <p>
        We may update these Terms from time to time. If we make material
        changes, we&rsquo;ll post the updated Terms here with a new
        &ldquo;last updated&rdquo; date. Continuing to use FilmNotes after a
        change takes effect means you accept the updated Terms.
      </p>

      <h2>14. Governing law</h2>
      <p>
        These Terms are governed by the laws of the State of Delaware,
        without regard to its conflict-of-laws principles.
      </p>

      <h2>15. Contact</h2>
      <p>
        Questions about these Terms can be sent to{" "}
        <a href="mailto:support@filmnotes.app">support@filmnotes.app</a>.
      </p>
    </LegalDoc>
  );
}
