-- 03_harden_rls_auto_enable_grant: remove RPC reachability of the platform
-- RLS auto-enable event-trigger function. The event trigger still fires on DDL
-- (triggers don't check EXECUTE grants); this only stops anon/authenticated
-- from calling it pointlessly over the REST API (clears a security linter warn).
revoke execute on function public.rls_auto_enable() from anon, authenticated, public;
