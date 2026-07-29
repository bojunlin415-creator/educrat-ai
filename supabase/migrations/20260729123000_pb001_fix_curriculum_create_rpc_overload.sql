drop function if exists public.create_curriculum_with_initial_version(
  text,
  uuid,
  uuid,
  uuid,
  integer,
  smallint,
  integer,
  text,
  text
);

drop function if exists public.create_curriculum_with_initial_version(
  text,
  uuid,
  uuid,
  uuid,
  integer,
  smallint,
  text,
  integer,
  text
);

create function public.create_curriculum_with_initial_version(
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

revoke all on function public.create_curriculum_with_initial_version(
  text,
  uuid,
  uuid,
  uuid,
  integer,
  smallint,
  integer,
  text,
  text
) from public, anon, authenticated;

grant execute on function public.create_curriculum_with_initial_version(
  text,
  uuid,
  uuid,
  uuid,
  integer,
  smallint,
  integer,
  text,
  text
) to authenticated;
