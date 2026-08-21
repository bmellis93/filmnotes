import type { Metadata } from "next";
import LegalDoc from "@/components/marketing/LegalDoc";

export const metadata: Metadata = {
  title: "Support — FilmNotes",
  description: "How galleries, sharing, roles, notifications, and storage work in FilmNotes.",
};

const UPDATED = "August 21, 2026";

const TOC = [
  { id: "getting-started", label: "Getting started" },
  { id: "galleries-videos", label: "Galleries & videos" },
  { id: "sharing", label: "Sharing review links" },
  { id: "review-approvals", label: "Client review & approvals" },
  { id: "roles", label: "Team roles & permissions" },
  { id: "notifications", label: "Notifications" },
  { id: "storage-billing", label: "Storage & billing" },
  { id: "inside-highlevel", label: "Using FilmNotes inside HighLevel" },
];

export default function SupportPage() {
  return (
    <LegalDoc title="Support" updated={UPDATED} toc={TOC}>
      <p>
        This page explains how FilmNotes actually works, end to end. If something here
        doesn&rsquo;t match what you&rsquo;re seeing, or you&rsquo;ve got a question this
        doesn&rsquo;t answer, email{" "}
        <a href="mailto:support@filmnotes.app">support@filmnotes.app</a> and we&rsquo;ll help
        directly.
      </p>

      <h2 id="getting-started">Getting started</h2>
      <p>
        FilmNotes is installed and accessed through your HighLevel account. Connect once from
        the login page, and you&rsquo;ll land on your Galleries dashboard. From there:
        create a gallery, upload video into it, and send a review link once it&rsquo;s ready.
        No separate FilmNotes account or password to manage &mdash; your HighLevel login is
        what gets you in.
      </p>

      <h2 id="galleries-videos">Galleries &amp; videos</h2>
      <p>
        A gallery is a collection of videos for one project &mdash; typically one client or
        one event. Upload video directly into a gallery, and each video moves through three
        stages: <strong>uploading</strong>, while it transfers; <strong>processing</strong>,
        while it&rsquo;s encoded for streaming (you&rsquo;ll see an animated placeholder on
        the thumbnail during this stage); and <strong>ready</strong>, once it&rsquo;s playable
        and shareable. Processing time depends on the length and resolution of the file &mdash;
        most videos are ready within a few minutes.
      </p>
      <p>
        You can archive a gallery or video you&rsquo;re done actively working on without
        deleting it, or delete it outright to free up storage. Deleting is immediate and
        removes the underlying video file &mdash; it can&rsquo;t be undone, so make sure
        anything you need is downloaded first.
      </p>

      <h2 id="sharing">Sharing review links</h2>
      <p>
        Share a video or an entire gallery by searching for a contact from your HighLevel
        account and sending them a link, by SMS, email, or both. Each recipient gets their own
        unique link, and you control what it allows:
      </p>
      <ul>
        <li><strong>Allow comments</strong> &mdash; whether they can leave timestamped feedback</li>
        <li><strong>Allow downloads</strong> &mdash; whether they can download the source file</li>
        <li><strong>Expiration</strong> &mdash; never, or automatically after 7, 30, or 90 days</li>
      </ul>
      <p>
        Sending to the same contact again reuses their existing link instead of creating a new
        one &mdash; so resending just refreshes the settings and expiration on the link they
        already have, rather than piling up duplicates.
      </p>
      <p>
        From a gallery&rsquo;s <strong>Manage links</strong> panel, you can see every link
        that&rsquo;s been sent, copy any of them, adjust permissions or expiration after the
        fact, <strong>revoke</strong> a link (instantly disables it, but keeps the record &mdash;
        useful if you want to turn it back on later), or <strong>delete</strong> it outright.
      </p>

      <h2 id="review-approvals">Client review &amp; approvals</h2>
      <p>
        Anyone with a review link can watch the video and leave comments pinned to an exact
        timestamp &mdash; no account required on their end. You can reply to a comment, mark it
        resolved once it&rsquo;s addressed, or remove it if needed. Clients can also mark a cut
        as approved or request changes, which updates the video&rsquo;s status for your whole
        team to see.
      </p>

      <h2 id="roles">Team roles &amp; permissions</h2>
      <p>
        Invite teammates from <strong>Settings &rarr; Team &amp; Permissions</strong>, and give
        each one a role:
      </p>
      <ul>
        <li><strong>Admin</strong> &mdash; full access, including billing, settings, and managing everyone else&rsquo;s role</li>
        <li><strong>Contributor</strong> &mdash; can upload, manage galleries and videos, send share links, and manage client comments</li>
        <li><strong>Uploader</strong> &mdash; can upload video, but can&rsquo;t manage shares or comments</li>
        <li><strong>Viewer</strong> &mdash; can view galleries and videos, but can&rsquo;t upload, share, or manage anything</li>
        <li><strong>None</strong> &mdash; no access at all, anywhere in the account. Use this to fully suspend a former team member without removing them.</li>
      </ul>
      <p>
        There&rsquo;s always at least one Admin on an account &mdash; you can&rsquo;t demote the
        last one, so you&rsquo;re never at risk of locking everyone out.
      </p>

      <h2 id="notifications">Notifications</h2>
      <p>
        Get notified when a client comments or acts on an approval, two ways, independently of
        each other &mdash; use either, both, or neither:
      </p>
      <ul>
        <li>
          Point FilmNotes at a HighLevel workflow with an Inbound Webhook trigger, to run your
          own automation off client activity
        </li>
        <li>
          Or set a plain notification email address in <strong>Settings</strong>, and
          we&rsquo;ll email you directly on the same events &mdash; no workflow required
        </li>
      </ul>
      <p>
        Client comments are batched into one notification per review session rather than
        firing one per comment, so a burst of feedback doesn&rsquo;t flood your inbox or your
        workflow.
      </p>

      <h2 id="storage-billing">Storage &amp; billing</h2>
      <p>
        Plans are differentiated primarily by included storage &mdash; the current tiers and
        pricing are always up to date on our <a href="/pricing">pricing page</a>. Storage is
        based on what&rsquo;s currently in your galleries: deleting a video frees up space
        right away.
      </p>
      <p>
        Going over your plan&rsquo;s included storage doesn&rsquo;t cut you off or block
        uploads &mdash; the excess is billed automatically each month alongside your
        subscription. Storage limits assume ordinary use; see our{" "}
        <a href="/terms">Terms of Service</a> for the full billing details.
      </p>

      <h2 id="inside-highlevel">Using FilmNotes inside HighLevel</h2>
      <p>
        FilmNotes can also run as an embedded view directly inside your HighLevel account,
        instead of opening the standalone dashboard in a separate tab. It signs you in
        automatically using your existing HighLevel session &mdash; nothing extra to connect.
      </p>
    </LegalDoc>
  );
}
