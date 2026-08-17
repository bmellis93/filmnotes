# FilmNotes

FilmNotes is a video review and approval app: owners create galleries, share review links with clients, and collect timestamped comments and approvals on video cuts. Built with Next.js (App Router), Prisma/Postgres, Mux for video playback, Cloudflare R2 for file storage, and GoHighLevel for owner auth and client messaging.

## Getting Started

Install dependencies and run the dev server:

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

### Environment variables

The app needs a `.env.local` with (at minimum):

- `DATABASE_URL`, `DIRECT_URL` — Postgres connection strings (Prisma)
- `GHL_CLIENT_ID`, `GHL_CLIENT_SECRET`, `GHL_REDIRECT_URI`, `GHL_AUTHORIZE_URL`, `GHL_API_BASE_URL`, `GHL_SCOPES` — GoHighLevel OAuth app credentials for owner sign-in
- `MUX_TOKEN_ID`, `MUX_TOKEN_SECRET`, `MUX_SIGNING_KEY`, `MUX_PRIVATE_KEY`, `MUX_WEBHOOK_SECRET`, `MUX_WEBHOOK_SIGNING_SECRET` — Mux video API + webhook verification
- `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_ENDPOINT`, `R2_BUCKET`, `R2_PUBLIC_BUCKET`, `R2_PUBLIC_BASE_URL`, `R2_SIGNED_URL_TTL` — Cloudflare R2 storage
- `APP_JWT_SECRET` — signs owner session cookies/embed tokens
- `CRON_SECRET` — authenticates the scheduled `nudge-unopened` job (see `vercel.json`)
- `DEV_OWNER_ORG_ID`, `DEV_OWNER_USER_ID`, `DEV_OWNER_ROLE` — local-only bypass for the owner session during development

### Database

```bash
npm run prisma:generate   # generate the Prisma client
npm run prisma:migrate    # run/create migrations locally
npm run prisma:studio     # inspect data
```

Production builds run `prisma migrate deploy` automatically (see the `build` script), so pending migrations apply on every Vercel deploy.

## Deployment

Deployed on Vercel at [filmnotes.app](https://filmnotes.app). The GoHighLevel Marketplace app's OAuth redirect URI must match `GHL_REDIRECT_URI` exactly, and Mux webhooks must point at `/api/mux/webhook` on the deployed domain.
