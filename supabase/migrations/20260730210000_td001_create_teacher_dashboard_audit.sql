-- TD-001 Teacher Dashboard
-- Forward-only dashboard audit foundation.
-- Apply only to approved non-production environments after review.

create table public.teacher_dashboard_audit_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  actor_id uuid not null references auth.users(id) on delete restrict,
  action text not null check (
    action in ('TEACHER_DASHBOARD_VIEWED', 'TEACHING_INSIGHT_VIEWED')
  ),
  metadata jsonb not null default '{}'::jsonb check (
    jsonb_typeof(metadata) = 'object'
  ),
  created_at timestamptz not null default timezone('utc'::text, now())
);

comment on table public.teacher_dashboard_audit_events is
  'TD-001 teacher dashboard audit events. Does not store dashboard payloads, charts, student answers, report exports, prompts, or provider responses.';

create index teacher_dashboard_audit_scope_idx
on public.teacher_dashboard_audit_events (organization_id, created_at desc);

alter table public.teacher_dashboard_audit_events enable row level security;
alter table public.teacher_dashboard_audit_events force row level security;

revoke all on table public.teacher_dashboard_audit_events from anon, authenticated;

grant select, insert on table public.teacher_dashboard_audit_events to authenticated;

create policy "teacher_dashboard_audit_select_admin"
on public.teacher_dashboard_audit_events
for select
to authenticated
using (
  public.has_organization_role(
    organization_id,
    array['organization_owner', 'organization_admin']::text[]
  )
);

create policy "teacher_dashboard_audit_insert_scoped"
on public.teacher_dashboard_audit_events
for insert
to authenticated
with check (
  public.has_organization_role(
    organization_id,
    array['organization_owner', 'organization_admin', 'teacher']::text[]
  )
  and actor_id = (select auth.uid())
);
