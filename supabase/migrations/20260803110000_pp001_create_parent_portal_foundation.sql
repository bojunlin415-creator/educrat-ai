-- PP-001 Parent Portal
-- Minimal guardian-child relationship boundary and parent portal audit.
-- Apply only to approved non-production environments before product verification.

create table public.student_guardians (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  student_id uuid not null references public.profiles(id) on delete restrict,
  guardian_user_id uuid not null references auth.users(id) on delete restrict,
  relationship_type text not null check (
    relationship_type in ('parent', 'guardian', 'caregiver', 'other')
  ),
  status text not null default 'pending' check (
    status in ('pending', 'active', 'revoked')
  ),
  verified_at timestamptz,
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now()),
  constraint student_guardians_verified_active check (
    status <> 'active' or verified_at is not null
  ),
  constraint student_guardians_not_self check (
    student_id <> guardian_user_id
  )
);

comment on table public.student_guardians is
  'PP-001 minimal verified guardian-child relationship boundary. It does not implement parent messaging, consent lifecycle, claims, or relationship verification UI.';

create unique index student_guardians_active_unique
on public.student_guardians (organization_id, student_id, guardian_user_id)
where status = 'active';

create index student_guardians_guardian_idx
on public.student_guardians (organization_id, guardian_user_id, status, created_at desc);

create index student_guardians_student_idx
on public.student_guardians (organization_id, student_id, status);

create table public.parent_portal_audit_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  actor_id uuid not null references auth.users(id) on delete restrict,
  action text not null check (
    action in (
      'PARENT_DASHBOARD_VIEWED',
      'PARENT_STUDENT_REPORT_VIEWED',
      'GUARDIAN_RELATIONSHIP_CREATED',
      'GUARDIAN_RELATIONSHIP_REVOKED'
    )
  ),
  metadata jsonb not null default '{}'::jsonb check (
    jsonb_typeof(metadata) = 'object'
  ),
  created_at timestamptz not null default timezone('utc'::text, now())
);

comment on table public.parent_portal_audit_events is
  'PP-001 parent portal audit events. Does not store raw learning events, answers, report payloads, internal recommendation reasons, prompts, provider responses, or child private content.';

create index parent_portal_audit_scope_idx
on public.parent_portal_audit_events (organization_id, actor_id, created_at desc);

create trigger student_guardians_set_updated_at
before update on public.student_guardians
for each row
execute function public.set_updated_at();

alter table public.student_guardians enable row level security;
alter table public.student_guardians force row level security;
alter table public.parent_portal_audit_events enable row level security;
alter table public.parent_portal_audit_events force row level security;

revoke all on table public.student_guardians from anon, authenticated;
revoke all on table public.parent_portal_audit_events from anon, authenticated;

grant select on table public.student_guardians to authenticated;
grant select, insert on table public.parent_portal_audit_events to authenticated;

create policy "student_guardians_select_own_active"
on public.student_guardians
for select
to authenticated
using (
  status = 'active'
  and guardian_user_id = (select auth.uid())
  and public.has_organization_role(
    organization_id,
    array['guardian']::text[]
  )
);

create policy "student_guardians_select_admin"
on public.student_guardians
for select
to authenticated
using (
  public.has_organization_role(
    organization_id,
    array['organization_owner', 'organization_admin']::text[]
  )
);

create policy "parent_portal_audit_select_admin"
on public.parent_portal_audit_events
for select
to authenticated
using (
  public.has_organization_role(
    organization_id,
    array['organization_owner', 'organization_admin']::text[]
  )
);

create policy "parent_portal_audit_insert_guardian"
on public.parent_portal_audit_events
for insert
to authenticated
with check (
  actor_id = (select auth.uid())
  and action in ('PARENT_DASHBOARD_VIEWED', 'PARENT_STUDENT_REPORT_VIEWED')
  and public.has_organization_role(
    organization_id,
    array['guardian']::text[]
  )
);
