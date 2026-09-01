-- Supabase's public-API roles (anon, authenticated) had full default CRUD
-- privileges (SELECT/INSERT/UPDATE/DELETE/etc.) on every table in this
-- schema -- not just the SELECT the advisor's pg_graphql_*_table_exposed
-- lints report, and not just on today's tables. Because the default ACL is
-- scoped to the `postgres` role (the role Prisma migrations run as), it
-- applies to any table a future migration creates too. This app never uses
-- Supabase Auth or the client SDK -- all access goes through the app's own
-- API layer via the `postgres` role, which is unaffected by revoking other
-- roles' privileges. RLS (see the VideoView migration) is one layer of
-- defense against this; removing the grant itself is a second, independent
-- one -- a table that's created without RLS enabled is no longer exposed
-- just by existing.
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon, authenticated;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon, authenticated;

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE ALL ON TABLES FROM anon, authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE ALL ON SEQUENCES FROM anon, authenticated;
