-- 007_pg_net_schema.sql — keep pg_net out of the API-exposed `public` schema (Supabase security advisor 0014).
-- pg_net cannot be relocated, so it is re-created in `extensions`. Its functions live in the `net` schema either
-- way, so private.invoke_reminders() (006) is unaffected; queued-but-unsent HTTP requests are not kept (none are
-- needed: the next cron run calls again).
drop extension if exists pg_net;
create extension if not exists pg_net with schema extensions;
