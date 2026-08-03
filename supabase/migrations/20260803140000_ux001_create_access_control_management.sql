-- UX-001: Role access, navigation, and admin control completion.
-- Forward-only additive migration. Apply only to local/development/staging.
-- Production must not be operated by automated agents.

create table public.access_control_audit_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  actor_id uuid not null references auth.users(id) on delete restrict,
  action text not null check (
    action in (
      'ACCESS_SETTINGS_VIEWED',
      'ROLE_ASSIGNED',
      'ROLE_REMOVED',
      'MEMBER_DISABLED',
      'MEMBER_ENABLED',
      'ROLE_CONTEXT_SWITCHED'
    )
  ),
  target_membership_id uuid references public.organization_members(id) on delete restrict,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc'::text, now()),
  constraint access_control_audit_metadata_object check (
    jsonb_typeof(metadata) = 'object'
  )
);

comment on table public.access_control_audit_events is
  'UX-001 access management audit events. Does not store passwords, tokens, raw invitation tokens, or sensitive student content.';

create index access_control_audit_scope_idx
on public.access_control_audit_events (organization_id, created_at desc);

create index access_control_audit_target_idx
on public.access_control_audit_events (target_membership_id, created_at desc)
where target_membership_id is not null;

alter table public.access_control_audit_events enable row level security;
alter table public.access_control_audit_events force row level security;

revoke all on table public.access_control_audit_events from anon, authenticated;
grant select, insert on table public.access_control_audit_events to authenticated;

create policy "access_control_audit_select_admin"
on public.access_control_audit_events
for select
to authenticated
using (
  public.has_organization_role(
    organization_id,
    array['organization_owner', 'organization_admin']::text[]
  )
);

create policy "access_control_audit_insert_admin"
on public.access_control_audit_events
for insert
to authenticated
with check (
  actor_id = (select auth.uid())
  and (
    public.has_organization_role(
      organization_id,
      array['organization_owner', 'organization_admin']::text[]
    )
    or (
      action = 'ROLE_CONTEXT_SWITCHED'
      and public.is_active_organization_member(organization_id)
    )
  )
);

create or replace function public.write_access_control_audit(
  p_organization_id uuid,
  p_actor_id uuid,
  p_action text,
  p_target_membership_id uuid default null,
  p_metadata jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_event_id uuid;
begin
  if p_actor_id is null or p_actor_id <> auth.uid() then
    raise exception using errcode = '42501', message = 'authentication_required';
  end if;

  if not (
    public.has_organization_role(
      p_organization_id,
      array['organization_owner', 'organization_admin']::text[]
    )
    or (
      p_action = 'ROLE_CONTEXT_SWITCHED'
      and public.is_active_organization_member(p_organization_id)
    )
  ) then
    raise exception using errcode = '42501', message = 'access_forbidden';
  end if;

  if p_action not in (
    'ACCESS_SETTINGS_VIEWED',
    'ROLE_ASSIGNED',
    'ROLE_REMOVED',
    'MEMBER_DISABLED',
    'MEMBER_ENABLED',
    'ROLE_CONTEXT_SWITCHED'
  ) then
    raise exception using errcode = '22023', message = 'invalid_access_action';
  end if;

  if p_metadata is null or jsonb_typeof(p_metadata) <> 'object' then
    raise exception using errcode = '22023', message = 'invalid_access_metadata';
  end if;

  insert into public.access_control_audit_events (
    organization_id,
    actor_id,
    action,
    target_membership_id,
    metadata
  ) values (
    p_organization_id,
    p_actor_id,
    p_action,
    p_target_membership_id,
    p_metadata
  )
  returning id into v_event_id;

  return v_event_id;
end;
$$;

create or replace function public.assign_organization_member_role(
  p_membership_id uuid,
  p_role text,
  p_reason text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor_id uuid := auth.uid();
  v_actor_role text;
  v_membership public.organization_members%rowtype;
begin
  if v_actor_id is null then
    raise exception using errcode = '42501', message = 'authentication_required';
  end if;

  if p_reason is null or char_length(btrim(p_reason)) not between 4 and 300 then
    raise exception using errcode = '22023', message = 'invalid_access_reason';
  end if;

  if p_role not in ('organization_admin', 'teacher', 'reviewer') then
    raise exception using errcode = '22023', message = 'invalid_access_role';
  end if;

  select *
  into v_membership
  from public.organization_members
  where id = p_membership_id
  for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'membership_not_found';
  end if;

  select actor.role
  into v_actor_role
  from public.organization_members as actor
  join public.organizations as organization
    on organization.id = actor.organization_id
  where actor.organization_id = v_membership.organization_id
    and actor.user_id = v_actor_id
    and actor.status = 'active'
    and actor.role in ('organization_owner', 'organization_admin')
    and organization.status = 'active'
    and organization.deleted_at is null;

  if v_actor_role is null then
    raise exception using errcode = '42501', message = 'access_forbidden';
  end if;

  if v_membership.user_id = v_actor_id then
    raise exception using errcode = '42501', message = 'self_elevation_forbidden';
  end if;

  if v_actor_role <> 'organization_owner' and p_role = 'organization_admin' then
    raise exception using errcode = '42501', message = 'admin_cannot_assign_admin';
  end if;

  if v_membership.role = 'organization_owner' then
    raise exception using errcode = '42501', message = 'owner_role_protected';
  end if;

  update public.organization_members
  set role = p_role,
      status = 'active',
      joined_at = coalesce(joined_at, timezone('utc'::text, now()))
  where id = p_membership_id;

  perform public.write_access_control_audit(
    v_membership.organization_id,
    v_actor_id,
    'ROLE_ASSIGNED',
    p_membership_id,
    jsonb_build_object(
      'fromRole', v_membership.role,
      'toRole', p_role,
      'reason', btrim(p_reason)
    )
  );

  return p_membership_id;
end;
$$;

create or replace function public.remove_organization_member_role(
  p_membership_id uuid,
  p_reason text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor_id uuid := auth.uid();
  v_actor_role text;
  v_membership public.organization_members%rowtype;
begin
  if v_actor_id is null then
    raise exception using errcode = '42501', message = 'authentication_required';
  end if;

  if p_reason is null or char_length(btrim(p_reason)) not between 4 and 300 then
    raise exception using errcode = '22023', message = 'invalid_access_reason';
  end if;

  select *
  into v_membership
  from public.organization_members
  where id = p_membership_id
  for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'membership_not_found';
  end if;

  select actor.role
  into v_actor_role
  from public.organization_members as actor
  join public.organizations as organization
    on organization.id = actor.organization_id
  where actor.organization_id = v_membership.organization_id
    and actor.user_id = v_actor_id
    and actor.status = 'active'
    and actor.role in ('organization_owner', 'organization_admin')
    and organization.status = 'active'
    and organization.deleted_at is null;

  if v_actor_role is null then
    raise exception using errcode = '42501', message = 'access_forbidden';
  end if;

  if v_membership.user_id = v_actor_id then
    raise exception using errcode = '42501', message = 'self_mutation_forbidden';
  end if;

  if v_membership.role = 'organization_owner' then
    raise exception using errcode = '23514', message = 'organization_requires_active_owner';
  end if;

  if v_actor_role <> 'organization_owner' and v_membership.role = 'organization_admin' then
    raise exception using errcode = '42501', message = 'admin_cannot_remove_admin';
  end if;

  update public.organization_members
  set status = 'removed'
  where id = p_membership_id;

  perform public.write_access_control_audit(
    v_membership.organization_id,
    v_actor_id,
    'ROLE_REMOVED',
    p_membership_id,
    jsonb_build_object(
      'fromRole', v_membership.role,
      'reason', btrim(p_reason)
    )
  );

  return p_membership_id;
end;
$$;

create or replace function public.set_organization_member_access_status(
  p_membership_id uuid,
  p_status text,
  p_reason text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor_id uuid := auth.uid();
  v_actor_role text;
  v_membership public.organization_members%rowtype;
  v_action text;
begin
  if v_actor_id is null then
    raise exception using errcode = '42501', message = 'authentication_required';
  end if;

  if p_status not in ('active', 'suspended') then
    raise exception using errcode = '22023', message = 'invalid_access_status';
  end if;

  if p_reason is null or char_length(btrim(p_reason)) not between 4 and 300 then
    raise exception using errcode = '22023', message = 'invalid_access_reason';
  end if;

  select *
  into v_membership
  from public.organization_members
  where id = p_membership_id
  for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'membership_not_found';
  end if;

  select actor.role
  into v_actor_role
  from public.organization_members as actor
  join public.organizations as organization
    on organization.id = actor.organization_id
  where actor.organization_id = v_membership.organization_id
    and actor.user_id = v_actor_id
    and actor.status = 'active'
    and actor.role in ('organization_owner', 'organization_admin')
    and organization.status = 'active'
    and organization.deleted_at is null;

  if v_actor_role is null then
    raise exception using errcode = '42501', message = 'access_forbidden';
  end if;

  if v_membership.user_id = v_actor_id then
    raise exception using errcode = '42501', message = 'self_mutation_forbidden';
  end if;

  if v_membership.role = 'organization_owner' and p_status <> 'active' then
    raise exception using errcode = '23514', message = 'organization_requires_active_owner';
  end if;

  if v_actor_role <> 'organization_owner' and v_membership.role = 'organization_admin' then
    raise exception using errcode = '42501', message = 'admin_cannot_mutate_admin';
  end if;

  update public.organization_members
  set status = p_status,
      joined_at = case
        when p_status = 'active' then coalesce(joined_at, timezone('utc'::text, now()))
        else joined_at
      end
  where id = p_membership_id;

  v_action := case
    when p_status = 'active' then 'MEMBER_ENABLED'
    else 'MEMBER_DISABLED'
  end;

  perform public.write_access_control_audit(
    v_membership.organization_id,
    v_actor_id,
    v_action,
    p_membership_id,
    jsonb_build_object(
      'fromStatus', v_membership.status,
      'toStatus', p_status,
      'reason', btrim(p_reason)
    )
  );

  return p_membership_id;
end;
$$;

revoke all on function public.write_access_control_audit(uuid, uuid, text, uuid, jsonb) from public, anon;
revoke all on function public.assign_organization_member_role(uuid, text, text) from public, anon;
revoke all on function public.remove_organization_member_role(uuid, text) from public, anon;
revoke all on function public.set_organization_member_access_status(uuid, text, text) from public, anon;

grant execute on function public.write_access_control_audit(uuid, uuid, text, uuid, jsonb) to authenticated;
grant execute on function public.assign_organization_member_role(uuid, text, text) to authenticated;
grant execute on function public.remove_organization_member_role(uuid, text) to authenticated;
grant execute on function public.set_organization_member_access_status(uuid, text, text) to authenticated;
