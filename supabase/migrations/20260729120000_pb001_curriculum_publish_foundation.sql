-- PB-001 Curriculum Publish Foundation
-- Forward-only status transition support. Historical migrations remain unchanged.

alter table public.curriculums
drop constraint if exists curriculums_status_check;

update public.curriculums
set status = 'published'
where status = 'active';

alter table public.curriculums
add constraint curriculums_status_check check (
  status in ('draft', 'in_review', 'published', 'archived')
);

alter table public.curriculum_versions
drop constraint if exists curriculum_versions_status_check;

alter table public.curriculum_versions
add constraint curriculum_versions_status_check check (
  status in ('draft', 'in_review', 'published', 'archived')
);

alter table public.curriculum_lifecycle_audit_events
drop constraint if exists curriculum_lifecycle_audit_events_action_check;

alter table public.curriculum_lifecycle_audit_events
add constraint curriculum_lifecycle_audit_events_action_check check (
  action in (
    'CURRICULUM_ARCHIVED',
    'CURRICULUM_RESTORED',
    'CURRICULUM_SOFT_DELETED',
    'CURRICULUM_PERMANENTLY_DELETED',
    'CURRICULUM_AI_GENERATED',
    'CURRICULUM_AI_EDITED',
    'CURRICULUM_AI_SAVED',
    'CURRICULUM_EXPORTED',
    'CURRICULUM_SUBMITTED',
    'CURRICULUM_REVIEWED',
    'CURRICULUM_PUBLISHED'
  )
);

drop policy if exists "curriculum_lifecycle_audit_insert_admin"
on public.curriculum_lifecycle_audit_events;
create policy "curriculum_lifecycle_audit_insert_admin"
on public.curriculum_lifecycle_audit_events
for insert
to authenticated
with check (
  (
    action in (
      'CURRICULUM_ARCHIVED',
      'CURRICULUM_RESTORED',
      'CURRICULUM_SOFT_DELETED',
      'CURRICULUM_PERMANENTLY_DELETED',
      'CURRICULUM_PUBLISHED'
    )
    and public.has_organization_role(
      organization_id,
      array['organization_owner', 'organization_admin']::text[]
    )
  )
  or (
    action in (
      'CURRICULUM_AI_GENERATED',
      'CURRICULUM_AI_EDITED',
      'CURRICULUM_AI_SAVED',
      'CURRICULUM_EXPORTED',
      'CURRICULUM_SUBMITTED'
    )
    and public.has_organization_role(
      organization_id,
      array['organization_owner', 'organization_admin', 'teacher']::text[]
    )
  )
  or (
    action = 'CURRICULUM_REVIEWED'
    and public.has_organization_role(
      organization_id,
      array['organization_owner', 'organization_admin', 'reviewer']::text[]
    )
  )
);

create or replace function public.create_curriculum_with_initial_version(
  p_name text,
  p_subject_id uuid,
  p_grade_id uuid,
  p_publisher_id uuid,
  p_school_year integer,
  p_semester smallint,
  p_version integer default 1,
  p_version_remark text default null,
  p_status text default 'draft'
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_organization_id uuid;
  v_curriculum_id uuid;
begin
  if v_user_id is null then
    raise exception using errcode = '42501', message = 'authentication_required';
  end if;

  v_organization_id := public.get_active_organization_id();

  if v_organization_id is null then
    raise exception using errcode = '42501', message = 'active_organization_required';
  end if;

  if not public.has_organization_role(
    v_organization_id,
    array['organization_owner', 'organization_admin']::text[]
  ) then
    raise exception using errcode = '42501', message = 'curriculum_write_forbidden';
  end if;

  if p_name is null
    or p_name <> btrim(p_name)
    or char_length(p_name) not between 2 and 120
    or p_school_year is null
    or p_school_year not between 100 and 999
    or p_semester is null
    or p_semester not in (1, 2)
    or p_version is null
    or p_version <> 1
    or p_status is null
    or p_status <> 'draft'
    or (
      nullif(btrim(p_version_remark), '') is not null
      and char_length(btrim(p_version_remark)) > 1000
    )
  then
    raise exception using errcode = '22023', message = 'invalid_curriculum_input';
  end if;

  if not exists (
    select 1 from public.subjects where id = p_subject_id and status = 'active'
  ) or not exists (
    select 1 from public.grades where id = p_grade_id and status = 'active'
  ) or not exists (
    select 1 from public.publishers where id = p_publisher_id and status = 'active'
  ) then
    raise exception using errcode = '22023', message = 'invalid_curriculum_reference';
  end if;

  insert into public.curriculums (
    organization_id,
    name,
    subject_id,
    grade_id,
    publisher_id,
    school_year,
    semester,
    status,
    created_by
  )
  values (
    v_organization_id,
    p_name,
    p_subject_id,
    p_grade_id,
    p_publisher_id,
    p_school_year,
    p_semester,
    'draft',
    v_user_id
  )
  returning id into v_curriculum_id;

  insert into public.curriculum_versions (
    curriculum_id,
    version,
    status,
    remark
  )
  values (
    v_curriculum_id,
    1,
    'draft',
    nullif(btrim(p_version_remark), '')
  );

  return v_curriculum_id;
exception
  when unique_violation then
    raise exception using errcode = '23505', message = 'curriculum_name_taken';
end;
$$;

create or replace function public.submit_curriculum_review(p_curriculum_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_organization_id uuid;
  v_version_id uuid;
begin
  if v_user_id is null then
    raise exception using errcode = '42501', message = 'authentication_required';
  end if;

  select organization_id
  into v_organization_id
  from public.curriculums
  where id = p_curriculum_id
    and deleted_at is null
    and status = 'draft'
  for update;

  if v_organization_id is null
    or v_organization_id <> public.get_active_organization_id()
  then
    raise exception using errcode = 'P0002', message = 'curriculum_not_found';
  end if;

  if not public.has_organization_role(
    v_organization_id,
    array['organization_owner', 'organization_admin', 'teacher']::text[]
  ) then
    raise exception using errcode = '42501', message = 'curriculum_submit_forbidden';
  end if;

  select id
  into v_version_id
  from public.curriculum_versions
  where curriculum_id = p_curriculum_id
  order by version desc
  limit 1
  for update;

  update public.curriculums
  set status = 'in_review', updated_at = timezone('utc'::text, now())
  where id = p_curriculum_id;

  update public.curriculum_versions
  set status = 'in_review'
  where id = v_version_id
    and status = 'draft';
  if not found then
    raise exception using errcode = '22023', message = 'curriculum_version_locked';
  end if;

  return p_curriculum_id;
end;
$$;

create or replace function public.reopen_curriculum_draft(p_curriculum_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_organization_id uuid;
  v_version_id uuid;
begin
  if v_user_id is null then
    raise exception using errcode = '42501', message = 'authentication_required';
  end if;

  select organization_id
  into v_organization_id
  from public.curriculums
  where id = p_curriculum_id
    and deleted_at is null
    and status = 'in_review'
  for update;

  if v_organization_id is null
    or v_organization_id <> public.get_active_organization_id()
  then
    raise exception using errcode = 'P0002', message = 'curriculum_not_found';
  end if;

  if not public.has_organization_role(
    v_organization_id,
    array['organization_owner', 'organization_admin', 'teacher']::text[]
  ) then
    raise exception using errcode = '42501', message = 'curriculum_reopen_forbidden';
  end if;

  select id
  into v_version_id
  from public.curriculum_versions
  where curriculum_id = p_curriculum_id
  order by version desc
  limit 1
  for update;

  update public.curriculums
  set status = 'draft', updated_at = timezone('utc'::text, now())
  where id = p_curriculum_id;

  update public.curriculum_versions
  set status = 'draft'
  where id = v_version_id
    and status = 'in_review';
  if not found then
    raise exception using errcode = '22023', message = 'curriculum_version_locked';
  end if;

  return p_curriculum_id;
end;
$$;

create or replace function public.review_curriculum(p_curriculum_id uuid)
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

  select organization_id
  into v_organization_id
  from public.curriculums
  where id = p_curriculum_id
    and deleted_at is null
    and status = 'in_review';

  if v_organization_id is null
    or v_organization_id <> public.get_active_organization_id()
  then
    raise exception using errcode = 'P0002', message = 'curriculum_not_found';
  end if;

  if not public.has_organization_role(
    v_organization_id,
    array['organization_owner', 'organization_admin', 'reviewer']::text[]
  ) then
    raise exception using errcode = '42501', message = 'curriculum_review_forbidden';
  end if;

  return p_curriculum_id;
end;
$$;

create or replace function public.publish_curriculum(p_curriculum_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_organization_id uuid;
  v_version_id uuid;
begin
  if v_user_id is null then
    raise exception using errcode = '42501', message = 'authentication_required';
  end if;

  select organization_id
  into v_organization_id
  from public.curriculums
  where id = p_curriculum_id
    and deleted_at is null
    and status = 'in_review'
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
    raise exception using errcode = '42501', message = 'curriculum_publish_forbidden';
  end if;

  select id
  into v_version_id
  from public.curriculum_versions
  where curriculum_id = p_curriculum_id
  order by version desc
  limit 1
  for update;

  update public.curriculums
  set status = 'published', updated_at = timezone('utc'::text, now())
  where id = p_curriculum_id;

  update public.curriculum_versions
  set status = 'published',
      published_at = coalesce(published_at, timezone('utc'::text, now()))
  where id = v_version_id
    and status = 'in_review';
  if not found then
    raise exception using errcode = '22023', message = 'curriculum_version_locked';
  end if;

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

  if not public.has_organization_role(
    v_organization_id,
    array['organization_owner', 'organization_admin']::text[]
  ) then
    raise exception using errcode = '42501', message = 'curriculum_archive_forbidden';
  end if;

  if v_status <> 'published' then
    raise exception using errcode = '22023', message = 'curriculum_archive_requires_published';
  end if;

  update public.curriculums
  set
    status = 'archived',
    updated_at = timezone('utc'::text, now())
  where id = p_curriculum_id;

  update public.curriculum_versions
  set status = 'archived'
  where curriculum_id = p_curriculum_id
    and status = 'published';

  return p_curriculum_id;
end;
$$;

create or replace function public.create_next_curriculum_version(p_curriculum_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_organization_id uuid;
  v_latest_version integer;
  v_new_version_id uuid;
begin
  if v_user_id is null then
    raise exception using errcode = '42501', message = 'authentication_required';
  end if;

  select organization_id
  into v_organization_id
  from public.curriculums
  where id = p_curriculum_id
    and deleted_at is null
    and status in ('published', 'archived')
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
    raise exception using errcode = '42501', message = 'curriculum_version_forbidden';
  end if;

  select coalesce(max(version), 0)
  into v_latest_version
  from public.curriculum_versions
  where curriculum_id = p_curriculum_id;

  insert into public.curriculum_versions (
    curriculum_id,
    version,
    status,
    remark
  )
  values (
    p_curriculum_id,
    v_latest_version + 1,
    'draft',
    'New editable version'
  )
  returning id into v_new_version_id;

  update public.curriculums
  set status = 'draft', updated_at = timezone('utc'::text, now())
  where id = p_curriculum_id;

  return v_new_version_id;
end;
$$;

revoke all on function public.submit_curriculum_review(uuid) from public, anon, authenticated;
revoke all on function public.reopen_curriculum_draft(uuid) from public, anon, authenticated;
revoke all on function public.review_curriculum(uuid) from public, anon, authenticated;
revoke all on function public.publish_curriculum(uuid) from public, anon, authenticated;
revoke all on function public.create_next_curriculum_version(uuid) from public, anon, authenticated;

grant execute on function public.submit_curriculum_review(uuid) to authenticated;
grant execute on function public.reopen_curriculum_draft(uuid) to authenticated;
grant execute on function public.review_curriculum(uuid) to authenticated;
grant execute on function public.publish_curriculum(uuid) to authenticated;
grant execute on function public.create_next_curriculum_version(uuid) to authenticated;
