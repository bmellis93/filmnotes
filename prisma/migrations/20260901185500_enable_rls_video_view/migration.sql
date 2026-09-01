-- VideoView was the only public table without Row Level Security enabled,
-- leaving its `token` column (a share-link access credential) readable by
-- anyone through Supabase's public PostgREST/GraphQL API using just the
-- anon key. Every other table already has RLS enabled with no policies
-- (default-deny for anon/authenticated); this brings VideoView in line.
-- The app's own Prisma connection uses the `postgres` role, which has
-- BYPASSRLS, so this has no effect on app behavior.
ALTER TABLE "VideoView" ENABLE ROW LEVEL SECURITY;
