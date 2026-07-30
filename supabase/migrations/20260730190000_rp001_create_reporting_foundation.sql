-- RP-001 Reporting Foundation
-- Forward-only report audit and optional cache foundation.
-- Apply only to approved non-production environments after review.

create table public.report_audit_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  actor_id uuid not null references auth.users(id) on delete restrict,
  action text not null check (action in ('REPORT_VIEWED', 'REPORT_EXPORTED')),
  metadata jsonb not null default '{}'::jsonb check (
    jsonb_typeof(metadata) = 'object'
  ),
  created_at timestamptz not null default timezone('utc'::text, now())
);

comment on table public.report_audit_events is
  'RP-001 report audit events. Does not store report payloads, PDF, Excel, CSV, charts, or learning answers.';

create table public.report_cache (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  report_type text not null check (
    report_type in ('student', 'teacher', 'organization')
  ),
  scope_key text not null check (
    scope_key = btrim(scope_key) and char_length(scope_key) between 1 and 200
  ),
  payload jsonb not null default '{}'::jsonb check (
    jsonb_typeof(payload) = 'object'
  ),
  generated_at timestamptz not null default timezone('utc'::text, now()),
  expires_at timestamptz,
  constraint report_cache_unique unique (
    organization_id,
    report_type,
    scope_key
  )
);

comment on table public.report_cache is
  'Optional RP-001 report cache foundation. Dashboards must still use Reporting Service; no dashboard UI is created.';

create index report_audit_events_scope_idx
on public.report_audit_events (organization_id, created_at desc);

create index report_cache_scope_idx
on public.report_cache (organization_id, report_type, generated_at desc);

alter table public.report_audit_events enable row level security;
alter table public.report_audit_events force row level security;
alter table public.report_cache enable row level security;
alter table public.report_cache force row level security;

revoke all on table public.report_audit_events from anon, authenticated;
revoke all on table public.report_cache from anon, authenticated;

grant select, insert on table public.report_audit_events to authenticated;
grant select, insert, update on table public.report_cache to authenticated;

create policy "report_audit_select_admin"
on public.report_audit_events
for select
to authenticated
using (
  public.has_organization_role(
    organization_id,
    array['organization_owner', 'organization_admin']::text[]
  )
);

create policy "report_audit_insert_scoped"
on public.report_audit_events
for insert
to authenticated
with check (
  public.is_active_organization_member(organization_id)
  and actor_id = (select auth.uid())
);

create policy "report_cache_select_scoped"
on public.report_cache
for select
to authenticated
using (
  public.is_active_organization_member(organization_id)
);

create policy "report_cache_write_admin"
on public.report_cache
for all
to authenticated
using (
  public.has_organization_role(
    organization_id,
    array['organization_owner', 'organization_admin']::text[]
  )
)
with check (
  public.has_organization_role(
    organization_id,
    array['organization_owner', 'organization_admin']::text[]
  )
);
