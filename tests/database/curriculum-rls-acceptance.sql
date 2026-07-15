\set ON_ERROR_STOP on

begin;

create function pg_temp.assert_true(p_condition boolean, p_message text)
returns void
language plpgsql
as $$
begin
  if not coalesce(p_condition, false) then
    raise exception 'Sprint 7 RLS assertion failed: %', p_message;
  end if;
end;
$$;

create function pg_temp.assert_curriculum_create_denied(p_name text)
returns void
language plpgsql
as $$
begin
  begin
    perform public.create_curriculum_with_initial_version(
      p_name,
      (select id from public.subjects where code = 'math'),
      (select id from public.grades where code = '4'),
      (select id from public.publishers where code = 'kang-hsuan'),
      115,
      1::smallint,
      'draft',
      1,
      'RLS acceptance'
    );
  exception
    when sqlstate '42501' then
      return;
  end;

  raise exception 'Sprint 7 RLS assertion failed: curriculum create was unexpectedly allowed';
end;
$$;

create function pg_temp.assert_anonymous_curriculum_select_denied()
returns void
language plpgsql
as $$
begin
  begin
    perform id from public.curriculums limit 1;
  exception
    when sqlstate '42501' then
      return;
  end;

  raise exception 'Sprint 7 RLS assertion failed: anonymous curriculum select was unexpectedly allowed';
end;
$$;

select pg_temp.assert_true(
  (
    select count(*) = 7
    from pg_catalog.pg_class as relation
    join pg_catalog.pg_namespace as namespace
      on namespace.oid = relation.relnamespace
    where namespace.nspname = 'public'
      and relation.relname in (
        'subjects',
        'grades',
        'publishers',
        'curriculums',
        'curriculum_versions',
        'chapters',
        'lessons'
      )
      and relation.relkind = 'r'
      and relation.relrowsecurity
      and relation.relforcerowsecurity
  ),
  'all seven curriculum tables must enable and force RLS'
);

select pg_temp.assert_true(
  not exists (
    select 1
    from (
      values
        ('subjects_select_authenticated_member'),
        ('grades_select_authenticated_member'),
        ('publishers_select_authenticated_member'),
        ('curriculums_select_active_organization'),
        ('curriculums_update_active_organization_admin'),
        ('curriculum_versions_select_active_organization'),
        ('chapters_select_active_organization'),
        ('lessons_select_active_organization')
    ) as expected(policy_name)
    where not exists (
      select 1
      from pg_catalog.pg_policies as policy
      where policy.schemaname = 'public'
        and policy.policyname = expected.policy_name
    )
  ),
  'all Sprint 7 RLS policies must exist'
);

insert into auth.users (
  id,
  aud,
  role,
  email,
  raw_app_meta_data,
  raw_user_meta_data,
  email_confirmed_at,
  created_at,
  updated_at
)
values
  ('00000000-0000-4000-8000-000000000001', 'authenticated', 'authenticated', 's7-owner@example.test', '{}'::jsonb, '{}'::jsonb, now(), now(), now()),
  ('00000000-0000-4000-8000-000000000002', 'authenticated', 'authenticated', 's7-admin@example.test', '{}'::jsonb, '{}'::jsonb, now(), now(), now()),
  ('00000000-0000-4000-8000-000000000003', 'authenticated', 'authenticated', 's7-teacher@example.test', '{}'::jsonb, '{}'::jsonb, now(), now(), now()),
  ('00000000-0000-4000-8000-000000000004', 'authenticated', 'authenticated', 's7-reviewer@example.test', '{}'::jsonb, '{}'::jsonb, now(), now(), now()),
  ('00000000-0000-4000-8000-000000000005', 'authenticated', 'authenticated', 's7-outsider@example.test', '{}'::jsonb, '{}'::jsonb, now(), now(), now());

insert into public.organizations (
  id,
  name,
  slug,
  status,
  created_by
)
values
  (
    '10000000-0000-4000-8000-000000000001',
    'Sprint 7 RLS Tenant A',
    'sprint-7-rls-tenant-a',
    'active',
    '00000000-0000-4000-8000-000000000001'
  ),
  (
    '10000000-0000-4000-8000-000000000002',
    'Sprint 7 RLS Tenant B',
    'sprint-7-rls-tenant-b',
    'active',
    '00000000-0000-4000-8000-000000000005'
  );

insert into public.organization_members (
  organization_id,
  user_id,
  role,
  status,
  joined_at
)
values
  ('10000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000001', 'organization_owner', 'active', now()),
  ('10000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000002', 'organization_admin', 'active', now()),
  ('10000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000003', 'teacher', 'active', now()),
  ('10000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000004', 'reviewer', 'active', now()),
  ('10000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-000000000005', 'organization_owner', 'active', now());

insert into public.user_preferences (user_id, active_organization_id)
values
  ('00000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001'),
  ('00000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000001'),
  ('00000000-0000-4000-8000-000000000003', '10000000-0000-4000-8000-000000000001'),
  ('00000000-0000-4000-8000-000000000004', '10000000-0000-4000-8000-000000000001'),
  ('00000000-0000-4000-8000-000000000005', '10000000-0000-4000-8000-000000000002');

insert into public.curriculums (
  id,
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
select
  '20000000-0000-4000-8000-000000000001',
  '10000000-0000-4000-8000-000000000001',
  'Sprint 7 RLS Curriculum A',
  subject.id,
  grade.id,
  publisher.id,
  115,
  1,
  'draft',
  '00000000-0000-4000-8000-000000000001'
from public.subjects as subject
cross join public.grades as grade
cross join public.publishers as publisher
where subject.code = 'math'
  and grade.code = '4'
  and publisher.code = 'kang-hsuan';

insert into public.curriculum_versions (
  id,
  curriculum_id,
  version,
  status,
  remark
)
values (
  '30000000-0000-4000-8000-000000000001',
  '20000000-0000-4000-8000-000000000001',
  1,
  'draft',
  'RLS acceptance'
);

insert into public.chapters (
  id,
  curriculum_version_id,
  chapter_no,
  title,
  order_no
)
values (
  '40000000-0000-4000-8000-000000000001',
  '30000000-0000-4000-8000-000000000001',
  1,
  'RLS Chapter',
  1
);

insert into public.lessons (
  id,
  chapter_id,
  lesson_no,
  title,
  learning_objectives,
  estimated_minutes,
  order_no,
  status
)
values (
  '50000000-0000-4000-8000-000000000001',
  '40000000-0000-4000-8000-000000000001',
  1,
  'RLS Lesson',
  array['RLS objective'],
  40,
  1,
  'draft'
);

-- Owner: tenant data is visible, editable, and new curriculum creation is allowed.
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000001', true);
select pg_temp.assert_true(
  (select count(*) = 1 from public.curriculums),
  'owner must see the active tenant curriculum'
);
update public.curriculums
set name = 'Sprint 7 RLS Owner Updated'
where id = '20000000-0000-4000-8000-000000000001';
select pg_temp.assert_true(
  (select name = 'Sprint 7 RLS Owner Updated' from public.curriculums where id = '20000000-0000-4000-8000-000000000001'),
  'owner must update curriculum fields allowed by column grants'
);
select pg_temp.assert_true(
  public.create_curriculum_with_initial_version(
    'Sprint 7 RLS Owner Created',
    (select id from public.subjects where code = 'math'),
    (select id from public.grades where code = '4'),
    (select id from public.publishers where code = 'kang-hsuan'),
    115,
    1::smallint,
    'draft',
    1,
    'Owner acceptance'
  ) is not null,
  'owner must create through the controlled RPC'
);
reset role;

-- Admin: same curriculum write privileges as owner.
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000002', true);
select pg_temp.assert_true(
  (select count(*) = 2 from public.curriculums),
  'admin must see active tenant curriculums'
);
update public.curriculums
set name = 'Sprint 7 RLS Admin Updated'
where id = '20000000-0000-4000-8000-000000000001';
select pg_temp.assert_true(
  (select name = 'Sprint 7 RLS Admin Updated' from public.curriculums where id = '20000000-0000-4000-8000-000000000001'),
  'admin must update curriculum fields allowed by column grants'
);
select pg_temp.assert_true(
  public.create_curriculum_with_initial_version(
    'Sprint 7 RLS Admin Created',
    (select id from public.subjects where code = 'math'),
    (select id from public.grades where code = '4'),
    (select id from public.publishers where code = 'kang-hsuan'),
    115,
    2::smallint,
    'draft',
    1,
    'Admin acceptance'
  ) is not null,
  'admin must create through the controlled RPC'
);
reset role;

-- Teacher: read-only across the entire hierarchy; writes are rejected.
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000003', true);
select pg_temp.assert_true(
  (select count(*) = 3 from public.curriculums)
  and (select count(*) = 3 from public.curriculum_versions)
  and (select count(*) = 1 from public.chapters)
  and (select count(*) = 1 from public.lessons),
  'teacher must read the active tenant curriculum hierarchy'
);
with changed as (
  update public.curriculums
  set name = 'Teacher must not update'
  where id = '20000000-0000-4000-8000-000000000001'
  returning id
)
select pg_temp.assert_true(count(*) = 0, 'teacher update must be filtered by RLS')
from changed;
select pg_temp.assert_curriculum_create_denied('Teacher must not create');
reset role;

-- Reviewer: read-only across the entire hierarchy; writes are rejected.
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000004', true);
select pg_temp.assert_true(
  (select count(*) = 3 from public.curriculums)
  and (select count(*) = 3 from public.curriculum_versions)
  and (select count(*) = 1 from public.chapters)
  and (select count(*) = 1 from public.lessons),
  'reviewer must read the active tenant curriculum hierarchy'
);
with changed as (
  update public.curriculums
  set name = 'Reviewer must not update'
  where id = '20000000-0000-4000-8000-000000000001'
  returning id
)
select pg_temp.assert_true(count(*) = 0, 'reviewer update must be filtered by RLS')
from changed;
select pg_temp.assert_curriculum_create_denied('Reviewer must not create');
reset role;

-- A valid owner in another active tenant cannot observe or modify tenant A.
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000005', true);
select pg_temp.assert_true(
  (select count(*) = 0 from public.curriculums),
  'cross-tenant curriculum reads must return no rows'
);
select pg_temp.assert_true(
  (select count(*) = 0 from public.curriculum_versions)
  and (select count(*) = 0 from public.chapters)
  and (select count(*) = 0 from public.lessons),
  'cross-tenant hierarchy reads must return no rows'
);
with changed as (
  update public.curriculums
  set name = 'Cross tenant update must not occur'
  where id = '20000000-0000-4000-8000-000000000001'
  returning id
)
select pg_temp.assert_true(count(*) = 0, 'cross-tenant updates must be filtered by RLS')
from changed;
reset role;

set local role anon;
select set_config('request.jwt.claim.sub', '', true);
select pg_temp.assert_anonymous_curriculum_select_denied();
reset role;

select 'Sprint 7 curriculum RLS acceptance passed' as result;

rollback;
