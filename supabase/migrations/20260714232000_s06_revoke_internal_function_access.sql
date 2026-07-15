-- Sprint 6 security hardening: Supabase grants function execution to API roles
-- through schema defaults. Trigger-only SECURITY DEFINER functions must never
-- be directly callable through the Data API.

revoke all on function public.prevent_last_organization_owner()
from public, anon, authenticated, service_role;

revoke all on function public.ensure_organization_has_owner()
from public, anon, authenticated, service_role;

revoke all on function public.clear_invalid_active_membership_preference()
from public, anon, authenticated, service_role;

revoke all on function public.clear_invalid_organization_preferences()
from public, anon, authenticated, service_role;
