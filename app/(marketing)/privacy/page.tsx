import type { Metadata } from "next";
import LegalDoc from "@/components/marketing/LegalDoc";

export const metadata: Metadata = {
  title: "Privacy Policy — FilmNotes",
  description: "How FilmNotes collects, uses, and protects your data.",
};

const UPDATED = "August 17, 2026";

export default function PrivacyPage() {
  return (
    <LegalDoc title="Privacy Policy" updated={UPDATED}>
      <p>
        This Privacy Policy explains how Renowned Media, LLC
        (&ldquo;FilmNotes,&rdquo; &ldquo;we,&rdquo; &ldquo;us,&rdquo; or
        &ldquo;our&rdquo;) collects, uses, and shares information when you use
        FilmNotes as an account owner or as a reviewer opening a shared
        review link.
      </p>

      <h2>1. Information we collect</h2>
      <h3>Account information</h3>
      <p>
        When you connect FilmNotes to your HighLevel account, we receive
        account and business information from HighLevel via OAuth — such as
        your name, email address, and the identifier of the HighLevel
        location you connected. We don&rsquo;t receive your HighLevel
        password.
      </p>
      <h3>Content you upload</h3>
      <p>
        Video files, thumbnails, gallery names, comments, and approval
        status that you or your reviewers create in FilmNotes.
      </p>
      <h3>Usage and device information</h3>
      <p>
        Information about how FilmNotes is used — such as pages visited,
        actions taken, browser and device type, and IP address — collected
        automatically through server logs and similar technology.
      </p>
      <h3>Cookies</h3>
      <p>
        We use cookies to keep you signed in and to protect the sign-in flow
        (for example, a short-lived cookie used to verify the HighLevel
        OAuth handshake). We don&rsquo;t use third-party advertising cookies.
      </p>

      <h2>2. How we use information</h2>
      <ul>
        <li>To provide, operate, and maintain FilmNotes</li>
        <li>To authenticate you through HighLevel and keep your galleries scoped to your account</li>
        <li>To process video for playback and streaming</li>
        <li>To calculate storage usage and bill accordingly, including any storage overage</li>
        <li>To communicate with you about your account, billing, or changes to the service</li>
        <li>To maintain the security of the service and investigate misuse</li>
      </ul>

      <h2>3. Third-party service providers</h2>
      <p>
        We share information with the following providers to the extent
        necessary to operate FilmNotes. Each processes data under its own
        privacy terms:
      </p>
      <ul>
        <li>
          <strong>HighLevel</strong> — authentication (OAuth), account/location
          data, billing, and certain client messaging
        </li>
        <li>
          <strong>Mux</strong> — video transcoding, hosting, and playback
        </li>
        <li>
          <strong>Cloudflare (R2)</strong> — storage of uploaded source video
          and files
        </li>
        <li>
          <strong>Vercel</strong> — application hosting and infrastructure
        </li>
      </ul>
      <p>
        We don&rsquo;t sell your information, and we don&rsquo;t share it with
        third parties for their own marketing purposes.
      </p>

      <h2>4. Reviewer information</h2>
      <p>
        If you open a review link, we process what&rsquo;s necessary to show
        you the gallery and record the comments and approvals you submit.
        Review links are created and shared by the account owner — if you
        have questions about how your feedback is being used, contact the
        person who sent you the link.
      </p>

      <h2>5. Data retention</h2>
      <p>
        We retain account and Content data for as long as your account is
        active. If you cancel your plan or disconnect FilmNotes from
        HighLevel, we retain your Content for a reasonable period in case
        you reconnect, and then delete it. You can request earlier deletion
        by contacting us.
      </p>

      <h2>6. Your rights</h2>
      <p>
        Depending on where you live, you may have rights to access, correct,
        export, or delete the personal information we hold about you. To
        exercise any of these rights, contact{" "}
        <a href="mailto:support@filmnotes.app">support@filmnotes.app</a> and
        we&rsquo;ll respond within a reasonable time.
      </p>

      <h2>7. Data security</h2>
      <p>
        We use industry-standard safeguards — including encryption in
        transit and access controls scoped to your account — to protect
        information stored in FilmNotes. No system is completely secure, and
        we can&rsquo;t guarantee absolute security.
      </p>

      <h2>8. Children&rsquo;s privacy</h2>
      <p>
        FilmNotes is a business tool and isn&rsquo;t directed at children. We
        don&rsquo;t knowingly collect personal information from anyone under
        16.
      </p>

      <h2>9. Changes to this policy</h2>
      <p>
        We may update this Privacy Policy from time to time. If we make
        material changes, we&rsquo;ll post the updated policy here with a new
        &ldquo;last updated&rdquo; date.
      </p>

      <h2>10. Contact</h2>
      <p>
        Questions about this policy can be sent to{" "}
        <a href="mailto:support@filmnotes.app">support@filmnotes.app</a>.
      </p>
    </LegalDoc>
  );
}
