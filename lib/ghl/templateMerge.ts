// Merge-tag resolution for GHL templates pulled into our own send flow.
//
// We only resolve {{review_link}} ourselves -- it's our own data, not
// something GHL knows about. Every other tag ({{contact.*}},
// {{custom_values.*}}, etc.) is left untouched: GHL resolves those
// server-side on any message sent through their API as long as we pass
// a contactId, which we always do. (Verified empirically -- a raw,
// unprocessed template sent via POST /conversations/messages came back
// with both {{contact.first_name}} and {{custom_values.*}} resolved.)

const REVIEW_LINK_TOKEN = /\{\{\s*review_link\s*\}\}/gi;

/** Plain-text content (SMS body, or an email's plain-text fallback). */
export function resolveTemplateText(raw: string, opts: { link: string }): string {
  if (REVIEW_LINK_TOKEN.test(raw)) {
    return raw.replace(REVIEW_LINK_TOKEN, opts.link);
  }
  return `${raw}\n\n${opts.link}`.trim();
}

/** HTML content (email template body). */
export function resolveTemplateHtml(raw: string, opts: { link: string }): string {
  if (REVIEW_LINK_TOKEN.test(raw)) {
    return raw.replace(REVIEW_LINK_TOKEN, opts.link);
  }
  const fallback = `<p><a href="${opts.link}">${opts.link}</a></p>`;
  return raw.includes("</body>") ? raw.replace("</body>", `${fallback}</body>`) : `${raw}${fallback}`;
}
