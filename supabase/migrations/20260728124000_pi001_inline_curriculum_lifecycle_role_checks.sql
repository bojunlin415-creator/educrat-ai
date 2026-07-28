-- PI-001 follow-up: keep lifecycle RPCs authoritative by inlining the
-- membership role check with the caller's resolved auth.uid().
-- This is forward-only and does not modify historical migrations.

create or replace function public.can_manage_curriculum_lifecycle(
  p_organization_id uuid,
  p_user_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.organization_members as membership
    join public.organizations as organization
      on organization.id = membership.organization_id
    where membership.organization_id = p_organization_id
      and membership.user_id = p_user_id
      and membership.status = 'active'
      and membership.role in ('organization_owner', 'organization_admin')
      and organization.status = 'active'
      and organization.deleted_at is null
  );
$$;

revoke all on function public.can_manage_curriculum_lifecycle(uuid, uuid)
from public, anon, authenticated, service_role;

create or replace function public.archive_curriculum(p_curriculum_id uuid)
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
    and curriculum.deleted_at is null
  for update;

  if v_organization_id is null
    or v_organization_id <> public.get_active_organization_id()
  then
    raise exception using errcode = 'P0002', message = 'curriculum_not_found';
  end if;

  if not public.can_manage_curriculum_lifecycle(v_organization_id, v_user_id) then
    raise exception using errcode = '42501', message = 'curriculum_archive_forbidden';
  end if;

  if v_status = 'archived' then
    raise exception using errcode = '22023', message = 'curriculum_already_archived';
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
  v_status text;
begin
  if v_user_id is null then
    raise exception using errcode = '42501', message = 'authentication_required';
  end if;

  select curriculum.organization_id, curriculum.status
  into v_organization_id, v_status
  from public.curriculums as curriculum
  where curriculum.id = p_curriculum_id
    and curriculum.deleted_at is null
  for update;

  if v_organization_id is null
    or v_organization_id <> public.get_active_organization_id()
  then
    raise exception using errcode = 'P0002', message = 'curriculum_not_found';
  end if;

  if not public.can_manage_curriculum_lifecycle(v_organization_id, v_user_id) then
    raise exception using errcode = '42501', message = 'curriculum_restore_forbidden';
  end if;

  if v_status <> 'archived' then
    raise exception using errcode = '22023', message = 'curriculum_not_archived';
  end if;

  update public.curriculums
  set
    status = 'active',
    updated_at = timezone('utc'::text, now())
  where id = p_curriculum_id;

  return p_curriculum_id;
end;
$$;

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

  if not public.can_manage_curriculum_lifecycle(v_organization_id, v_user_id) then
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

  if not public.can_manage_curriculum_lifecycle(v_organization_id, v_user_id) then
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
exception
  when unique_violation then
    raise exception using errcode = '23505', message = 'curriculum_restore_name_taken';
end;
$$;

create or replace function public.permanently_delete_curriculum(
  p_curriculum_id uuid,
  p_confirmation text
)
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

  if not public.can_manage_curriculum_lifecycle(v_organization_id, v_user_id) then
    raise exception using errcode = '42501', message = 'curriculum_permanent_delete_forbidden';
  end if;

  if nullif(btrim(p_confirmation), '') is null then
    raise exception using errcode = '22023', message = 'invalid_permanent_delete_confirmation';
  end if;

  if exists (
    select 1
    from public.curriculums as curriculum
    where curriculum.id = p_curriculum_id
      and curriculum.deleted_at is null
  ) then
    raise exception using errcode = '22023', message = 'curriculum_not_deleted';
  end if;

  if exists (
    select 1
    from public.curriculum_versions as curriculum_version
    where curriculum_version.curriculum_id = p_curriculum_id
      and curriculum_version.status = 'published'
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
    select curriculum_version.id
    from public.curriculum_versions as curriculum_version
    where curriculum_version.curriculum_id = p_curriculum_id
  );

  delete from public.curriculum_versions
  where curriculum_id = p_curriculum_id;

  delete from public.curriculums
  where id = p_curriculum_id;

  return p_curriculum_id;
end;
$$;

revoke all on function public.archive_curriculum(uuid)
from public, anon, service_role;
revoke all on function public.restore_archived_curriculum(uuid)
from public, anon, service_role;
revoke all on function public.soft_delete_curriculum(uuid, text)
from public, anon, service_role;
revoke all on function public.restore_deleted_curriculum(uuid)
from public, anon, service_role;
revoke all on function public.permanently_delete_curriculum(uuid, text)
from public, anon, service_role;

grant execute on function public.archive_curriculum(uuid)
to authenticated;
grant execute on function public.restore_archived_curriculum(uuid)
to authenticated;
grant execute on function public.soft_delete_curriculum(uuid, text)
to authenticated;
grant execute on function public.restore_deleted_curriculum(uuid)
to authenticated;
grant execute on function public.permanently_delete_curriculum(uuid, text)
to authenticated;
