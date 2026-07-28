-- PI-001 Curriculum Delete & Recycle Bin Integration
-- Additive, non-destructive migration. Historical Sprint migrations remain unchanged.

alter table public.curriculums
add column if not exists deleted_at timestamptz,
add column if not exists deleted_by uuid references auth.users(id) on delete set null,
add column if not exists deletion_reason text;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'curriculums_deletion_reason_length'
      and conrelid = 'public.curriculums'::regclass
  ) then
    alter table public.curriculums
    add constraint curriculums_deletion_reason_length
    check (
      deletion_reason is null
      or char_length(deletion_reason) between 1 and 500
    );
  end if;
end;
$$;

create index if not exists curriculums_active_recent_idx
on public.curriculums (organization_id, updated_at desc)
where deleted_at is null;

create index if not exists curriculums_recycle_bin_recent_idx
on public.curriculums (organization_id, deleted_at desc)
where deleted_at is not null;

grant update (
  deleted_at,
  deleted_by,
  deletion_reason,
  status
) on table public.curriculums to authenticated;

create table if not exists public.curriculum_lifecycle_audit_events (
  event_id uuid primary key,
  occurred_at timestamptz not null,
  actor_id uuid not null references auth.users(id) on delete restrict,
  actor_type text not null check (actor_type = 'ACCOUNT'),
  acting_role text not null,
  organization_id uuid not null references public.organizations(id) on delete restrict,
  curriculum_id uuid not null,
  action text not null check (
    action in (
      'CURRICULUM_ARCHIVED',
      'CURRICULUM_RESTORED',
      'CURRICULUM_SOFT_DELETED',
      'CURRICULUM_PERMANENTLY_DELETED'
    )
  ),
  reason text not null,
  result text not null check (result in ('SUCCEEDED', 'DENIED', 'FAILED')),
  state_before text not null,
  state_after text not null,
  request_id text not null,
  correlation_id text not null,
  previous_hash text,
  current_hash text not null,
  metadata jsonb not null default '{}'::jsonb,
  version integer not null default 1,
  created_at timestamptz not null default timezone('utc'::text, now()),
  constraint curriculum_lifecycle_audit_previous_hash_format check (
    previous_hash is null or previous_hash ~ '^[a-f0-9]{64}$'
  ),
  constraint curriculum_lifecycle_audit_current_hash_format check (
    current_hash ~ '^[a-f0-9]{64}$'
  )
);

comment on table public.curriculum_lifecycle_audit_events is
  'Append-only PI-001 lifecycle audit receipts for curriculum archive, recycle, restore, and permanent deletion.';

alter table public.curriculum_lifecycle_audit_events enable row level security;
alter table public.curriculum_lifecycle_audit_events force row level security;

revoke all on table public.curriculum_lifecycle_audit_events from anon, authenticated;
grant select, insert on table public.curriculum_lifecycle_audit_events to authenticated;

create index if not exists curriculum_lifecycle_audit_chain_idx
on public.curriculum_lifecycle_audit_events (
  organization_id,
  occurred_at desc,
  event_id
);

create index if not exists curriculum_lifecycle_audit_curriculum_idx
on public.curriculum_lifecycle_audit_events (
  organization_id,
  curriculum_id,
  occurred_at desc
);

drop policy if exists "curriculum_lifecycle_audit_select_member"
on public.curriculum_lifecycle_audit_events;
create policy "curriculum_lifecycle_audit_select_member"
on public.curriculum_lifecycle_audit_events
for select
to authenticated
using (
  public.is_active_organization_member(organization_id)
);

drop policy if exists "curriculum_lifecycle_audit_insert_admin"
on public.curriculum_lifecycle_audit_events;
create policy "curriculum_lifecycle_audit_insert_admin"
on public.curriculum_lifecycle_audit_events
for insert
to authenticated
with check (
  public.has_organization_role(
    organization_id,
    array['organization_owner', 'organization_admin']::text[]
  )
);

create or replace function public.prevent_curriculum_lifecycle_audit_mutation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  raise exception using errcode = '42501', message = 'audit_events_are_immutable';
end;
$$;

drop trigger if exists curriculum_lifecycle_audit_no_update
on public.curriculum_lifecycle_audit_events;
create trigger curriculum_lifecycle_audit_no_update
before update on public.curriculum_lifecycle_audit_events
for each row execute function public.prevent_curriculum_lifecycle_audit_mutation();

drop trigger if exists curriculum_lifecycle_audit_no_delete
on public.curriculum_lifecycle_audit_events;
create trigger curriculum_lifecycle_audit_no_delete
before delete on public.curriculum_lifecycle_audit_events
for each row execute function public.prevent_curriculum_lifecycle_audit_mutation();

create or replace function public.soft_delete_curriculum(
  p_curriculum_id uuid,
  p_reason text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_organization_id uuid;
  v_status text;
begin
  if v_user_id is null then
    raise exception using errcode = '42501', message = 'authentication_required';
  end if;

  select curriculum.organization_id, curriculum.status
  into v_organization_id, v_status
  from public.curriculums as curriculum
  where curriculum.id = p_curriculum_id
  for update;

  if v_organization_id is null
    or v_organization_id <> public.get_active_organization_id()
  then
    raise exception using errcode = 'P0002', message = 'curriculum_not_found';
  end if;

  if not public.has_organization_role(
    v_organization_id,
    array['organization_owner', 'organization_admin']::text[]
  ) then
    raise exception using errcode = '42501', message = 'curriculum_delete_forbidden';
  end if;

  if v_status = 'active' then
    raise exception using errcode = '42501', message = 'published_curriculum_must_be_archived';
  end if;

  if exists (
    select 1
    from public.curriculums as curriculum
    where curriculum.id = p_curriculum_id
      and curriculum.deleted_at is not null
  ) then
    raise exception using errcode = '22023', message = 'curriculum_already_deleted';
  end if;

  update public.curriculums
  set
    deleted_at = timezone('utc'::text, now()),
    deleted_by = v_user_id,
    deletion_reason = nullif(btrim(p_reason), ''),
    updated_at = timezone('utc'::text, now())
  where id = p_curriculum_id;

  return p_curriculum_id;
end;
$$;

create or replace function public.restore_deleted_curriculum(p_curriculum_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_organization_id uuid;
begin
  if v_user_id is null then
    raise exception using errcode = '42501', message = 'authentication_required';
  end if;

  select curriculum.organization_id
  into v_organization_id
  from public.curriculums as curriculum
  where curriculum.id = p_curriculum_id
  for update;

  if v_organization_id is null
    or v_organization_id <> public.get_active_organization_id()
  then
    raise exception using errcode = 'P0002', message = 'curriculum_not_found';
  end if;

  if not public.has_organization_role(
    v_organization_id,
    array['organization_owner', 'organization_admin']::text[]
  ) then
    raise exception using errcode = '42501', message = 'curriculum_restore_forbidden';
  end if;

  if exists (
    select 1
    from public.curriculums as curriculum
    where curriculum.id = p_curriculum_id
      and curriculum.deleted_at is null
  ) then
    raise exception using errcode = '22023', message = 'curriculum_not_deleted';
  end if;

  update public.curriculums
  set
    deleted_at = null,
    deleted_by = null,
    deletion_reason = null,
    updated_at = timezone('utc'::text, now())
  where id = p_curriculum_id;

  return p_curriculum_id;
end;
$$;

create or replace function public.archive_curriculum(p_curriculum_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_organization_id uuid;
begin
  if v_user_id is null then
    raise exception using errcode = '42501', message = 'authentication_required';
  end if;

  select curriculum.organization_id
  into v_organization_id
  from public.curriculums as curriculum
  where curriculum.id = p_curriculum_id
    and curriculum.deleted_at is null
  for update;

  if v_organization_id is null
    or v_organization_id <> public.get_active_organization_id()
  then
    raise exception using errcode = 'P0002', message = 'curriculum_not_found';
  end if;

  if not public.has_organization_role(
    v_organization_id,
    array['organization_owner', 'organization_admin']::text[]
  ) then
    raise exception using errcode = '42501', message = 'curriculum_archive_forbidden';
  end if;

  update public.curriculums
  set
    status = 'archived',
    updated_at = timezone('utc'::text, now())
  where id = p_curriculum_id;

  return p_curriculum_id;
end;
$$;

create or replace function public.restore_archived_curriculum(p_curriculum_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_organization_id uuid;
begin
  if v_user_id is null then
    raise exception using errcode = '42501', message = 'authentication_required';
  end if;

  select curriculum.organization_id
  into v_organization_id
  from public.curriculums as curriculum
  where curriculum.id = p_curriculum_id
    and curriculum.status = 'archived'
    and curriculum.deleted_at is null
  for update;

  if v_organization_id is null
    or v_organization_id <> public.get_active_organization_id()
  then
    raise exception using errcode = 'P0002', message = 'curriculum_not_found';
  end if;

  if not public.has_organization_role(
    v_organization_id,
    array['organization_owner', 'organization_admin']::text[]
  ) then
    raise exception using errcode = '42501', message = 'curriculum_restore_forbidden';
  end if;

  update public.curriculums
  set
    status = 'active',
    updated_at = timezone('utc'::text, now())
  where id = p_curriculum_id;

  return p_curriculum_id;
end;
$$;

create or replace function public.permanently_delete_curriculum(p_curriculum_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_organization_id uuid;
  v_deleted_at timestamptz;
begin
  if v_user_id is null then
    raise exception using errcode = '42501', message = 'authentication_required';
  end if;

  select curriculum.organization_id, curriculum.deleted_at
  into v_organization_id, v_deleted_at
  from public.curriculums as curriculum
  where curriculum.id = p_curriculum_id
  for update;

  if v_organization_id is null
    or v_organization_id <> public.get_active_organization_id()
  then
    raise exception using errcode = 'P0002', message = 'curriculum_not_found';
  end if;

  if not public.has_organization_role(
    v_organization_id,
    array['organization_owner', 'organization_admin']::text[]
  ) then
    raise exception using errcode = '42501', message = 'curriculum_permanent_delete_forbidden';
  end if;

  if v_deleted_at is null then
    raise exception using errcode = '22023', message = 'curriculum_not_deleted';
  end if;

  if exists (
    select 1
    from public.curriculum_versions
    where curriculum_id = p_curriculum_id
      and status = 'published'
  ) then
    raise exception using errcode = '42501', message = 'curriculum_dependency_blocked';
  end if;

  delete from public.lessons
  where chapter_id in (
    select chapter.id
    from public.chapters as chapter
    join public.curriculum_versions as curriculum_version
      on curriculum_version.id = chapter.curriculum_version_id
    where curriculum_version.curriculum_id = p_curriculum_id
  );

  delete from public.chapters
  where curriculum_version_id in (
    select id
    from public.curriculum_versions
    where curriculum_id = p_curriculum_id
  );

  delete from public.curriculum_versions
  where curriculum_id = p_curriculum_id;

  delete from public.curriculums
  where id = p_curriculum_id;

  return p_curriculum_id;
end;
$$;

revoke all on function public.soft_delete_curriculum(uuid, text)
from public, anon, service_role;
revoke all on function public.restore_deleted_curriculum(uuid)
from public, anon, service_role;
revoke all on function public.archive_curriculum(uuid)
from public, anon, service_role;
revoke all on function public.restore_archived_curriculum(uuid)
from public, anon, service_role;
revoke all on function public.permanently_delete_curriculum(uuid)
from public, anon, service_role;
revoke all on function public.prevent_curriculum_lifecycle_audit_mutation()
from public, anon, authenticated, service_role;

grant execute on function public.soft_delete_curriculum(uuid, text)
to authenticated;
grant execute on function public.restore_deleted_curriculum(uuid)
to authenticated;
grant execute on function public.archive_curriculum(uuid)
to authenticated;
grant execute on function public.restore_archived_curriculum(uuid)
to authenticated;
grant execute on function public.permanently_delete_curriculum(uuid)
to authenticated;

-- Direct hard DELETE remains denied. Permanent deletion must use the controlled
-- RPC, which verifies auth.uid(), active organization, owner/admin role, recycle
-- state, and protected published-version dependencies before deleting hierarchy
-- rows in a safe order.
