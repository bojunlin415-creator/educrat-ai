-- PI-001 follow-up: deleted curricula must not reserve active curriculum names.
-- This migration is forward-only and does not modify historical migrations.

do $$
begin
  if exists (
    select 1
    from (
      select organization_id, lower(name) as normalized_name
      from public.curriculums
      where deleted_at is null
      group by organization_id, lower(name)
      having count(*) > 1
    ) as active_name_conflicts
  ) then
    raise exception using
      errcode = '23505',
      message = 'active_curriculum_name_conflict_requires_manual_resolution';
  end if;
end;
$$;

drop index if exists public.curriculums_unique_name_per_organization_idx;

create unique index if not exists curriculums_unique_active_name_per_organization_idx
on public.curriculums (organization_id, lower(name))
where deleted_at is null;

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
exception
  when unique_violation then
    raise exception using errcode = '23505', message = 'curriculum_restore_name_taken';
end;
$$;

revoke all on function public.restore_deleted_curriculum(uuid)
from public, anon, service_role;

grant execute on function public.restore_deleted_curriculum(uuid)
to authenticated;
