\set ON_ERROR_STOP on

begin;

create function pg_temp.assert_true(p_condition boolean, p_message text)
returns void
language plpgsql
as $$
begin
  if not coalesce(p_condition, false) then
    raise exception 'Sprint 8 RLS assertion failed: %', p_message;
  end if;
end;
$$;

create function pg_temp.assert_chapter_create_denied(
  p_version_id uuid,
  p_title text
)
returns void
language plpgsql
as $$
begin
  begin
    perform public.create_chapter(p_version_id, 88, p_title, null, 'draft');
  exception
    when sqlstate '42501' or sqlstate 'P0002' then return;
  end;
  raise exception 'Sprint 8 RLS assertion failed: chapter create was unexpectedly allowed';
end;
$$;

create function pg_temp.assert_lesson_update_denied(
  p_lesson_id uuid,
  p_title text
)
returns void
language plpgsql
as $$
begin
  begin
    perform public.update_lesson(
      p_lesson_id,
      1,
      p_title,
      array['Denied'],
      30,
      null,
      'draft'
    );
  exception
    when sqlstate '42501' or sqlstate 'P0002' then return;
  end;
  raise exception 'Sprint 8 RLS assertion failed: lesson update was unexpectedly allowed';
end;
$$;

create function pg_temp.assert_direct_chapter_insert_denied(p_version_id uuid)
returns void
language plpgsql
as $$
begin
  begin
    insert into public.chapters (
      curriculum_version_id,
      chapter_no,
      title,
      order_no,
      status
    ) values (p_version_id, 99, 'Direct write denied', 99, 'draft');
  exception
    when sqlstate '42501' then return;
  end;
  raise exception 'Sprint 8 RLS assertion failed: direct chapter insert was unexpectedly allowed';
end;
$$;

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
  ('81000000-0000-4000-8000-000000000001', 'authenticated', 'authenticated', 's8-owner@example.test', '{}'::jsonb, '{}'::jsonb, now(), now(), now()),
  ('81000000-0000-4000-8000-000000000002', 'authenticated', 'authenticated', 's8-admin@example.test', '{}'::jsonb, '{}'::jsonb, now(), now(), now()),
  ('81000000-0000-4000-8000-000000000003', 'authenticated', 'authenticated', 's8-teacher@example.test', '{}'::jsonb, '{}'::jsonb, now(), now(), now()),
  ('81000000-0000-4000-8000-000000000004', 'authenticated', 'authenticated', 's8-reviewer@example.test', '{}'::jsonb, '{}'::jsonb, now(), now(), now()),
  ('81000000-0000-4000-8000-000000000005', 'authenticated', 'authenticated', 's8-outsider@example.test', '{}'::jsonb, '{}'::jsonb, now(), now(), now());

insert into public.organizations (id, name, slug, status, created_by)
values
  ('82000000-0000-4000-8000-000000000001', 'Sprint 8 Tenant A', 'sprint-8-tenant-a', 'active', '81000000-0000-4000-8000-000000000001'),
  ('82000000-0000-4000-8000-000000000002', 'Sprint 8 Tenant B', 'sprint-8-tenant-b', 'active', '81000000-0000-4000-8000-000000000005');

insert into public.organization_members (
  organization_id,
  user_id,
  role,
  status,
  joined_at
)
values
  ('82000000-0000-4000-8000-000000000001', '81000000-0000-4000-8000-000000000001', 'organization_owner', 'active', now()),
  ('82000000-0000-4000-8000-000000000001', '81000000-0000-4000-8000-000000000002', 'organization_admin', 'active', now()),
  ('82000000-0000-4000-8000-000000000001', '81000000-0000-4000-8000-000000000003', 'teacher', 'active', now()),
  ('82000000-0000-4000-8000-000000000001', '81000000-0000-4000-8000-000000000004', 'reviewer', 'active', now()),
  ('82000000-0000-4000-8000-000000000002', '81000000-0000-4000-8000-000000000005', 'organization_owner', 'active', now());

insert into public.user_preferences (user_id, active_organization_id)
values
  ('81000000-0000-4000-8000-000000000001', '82000000-0000-4000-8000-000000000001'),
  ('81000000-0000-4000-8000-000000000002', '82000000-0000-4000-8000-000000000001'),
  ('81000000-0000-4000-8000-000000000003', '82000000-0000-4000-8000-000000000001'),
  ('81000000-0000-4000-8000-000000000004', '82000000-0000-4000-8000-000000000001'),
  ('81000000-0000-4000-8000-000000000005', '82000000-0000-4000-8000-000000000002');

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
  '83000000-0000-4000-8000-000000000001',
  '82000000-0000-4000-8000-000000000001',
  'Sprint 8 Editor Curriculum',
  subject.id,
  grade.id,
  publisher.id,
  115,
  1,
  'draft',
  '81000000-0000-4000-8000-000000000001'
from public.subjects as subject
cross join public.grades as grade
cross join public.publishers as publisher
where subject.code = 'math'
  and grade.code = '4'
  and publisher.code = 'kang-hsuan';

insert into public.curriculum_versions (id, curriculum_id, version, status)
values (
  '84000000-0000-4000-8000-000000000001',
  '83000000-0000-4000-8000-000000000001',
  1,
  'draft'
);

-- Owner can create, update, reorder, and delete through controlled RPCs.
set local role authenticated;
select set_config('request.jwt.claim.sub', '81000000-0000-4000-8000-000000000001', true);
select public.create_chapter(
  '84000000-0000-4000-8000-000000000001',
  1,
  'Owner Chapter One',
  'First chapter',
  'draft'
) as owner_chapter_one \gset
select public.create_chapter(
  '84000000-0000-4000-8000-000000000001',
  2,
  'Owner Chapter Two',
  null,
  'draft'
) as owner_chapter_two \gset
select public.create_lesson(
  :'owner_chapter_one'::uuid,
  1,
  'Owner Lesson One',
  array['Objective one'],
  40,
  'Teaching note',
  'draft'
) as owner_lesson_one \gset
select public.create_lesson(
  :'owner_chapter_one'::uuid,
  2,
  'Owner Lesson Two',
  array['Objective two'],
  45,
  null,
  'draft'
) as owner_lesson_two \gset

select public.reorder_chapters(
  '84000000-0000-4000-8000-000000000001',
  array[:'owner_chapter_two'::uuid, :'owner_chapter_one'::uuid]
);
select public.reorder_lessons(
  :'owner_chapter_one'::uuid,
  array[:'owner_lesson_two'::uuid, :'owner_lesson_one'::uuid]
);
select pg_temp.assert_true(
  (select order_no = 1 from public.chapters where id = :'owner_chapter_two'::uuid)
  and (select order_no = 1 from public.lessons where id = :'owner_lesson_two'::uuid),
  'owner reorder must persist contiguous server order'
);
select public.update_chapter(
  :'owner_chapter_one'::uuid,
  1,
  'Owner Chapter Updated',
  'Updated description',
  'active'
);
select public.update_lesson(
  :'owner_lesson_one'::uuid,
  1,
  'Owner Lesson Updated',
  array['Updated objective'],
  50,
  'Updated teaching note',
  'active'
);
select pg_temp.assert_true(
  (select status = 'active' from public.chapters where id = :'owner_chapter_one'::uuid)
  and (
    select
      teaching_notes = 'Updated teaching note'
      and difficulty is null
      and keywords = '{}'::text[]
    from public.lessons
    where id = :'owner_lesson_one'::uuid
  ),
  'owner updates and AI-ready defaults must remain backward compatible'
);
select pg_temp.assert_direct_chapter_insert_denied(
  '84000000-0000-4000-8000-000000000001'
);
reset role;

-- Admin can mutate the same active-tenant hierarchy.
set local role authenticated;
select set_config('request.jwt.claim.sub', '81000000-0000-4000-8000-000000000002', true);
select public.update_chapter(
  :'owner_chapter_two'::uuid,
  2,
  'Admin Updated Chapter',
  null,
  'active'
);
select public.create_lesson(
  :'owner_chapter_two'::uuid,
  1,
  'Admin Lesson',
  array['Admin objective'],
  30,
  null,
  'draft'
) as admin_lesson \gset
select pg_temp.assert_true(
  (select title = 'Admin Updated Chapter' from public.chapters where id = :'owner_chapter_two'::uuid)
  and (select count(*) = 1 from public.lessons where id = :'admin_lesson'::uuid),
  'admin must create and update hierarchy content'
);
reset role;

-- Teacher and reviewer retain read-only access.
set local role authenticated;
select set_config('request.jwt.claim.sub', '81000000-0000-4000-8000-000000000003', true);
select pg_temp.assert_true(
  (select count(*) = 2 from public.chapters)
  and (select count(*) = 3 from public.lessons),
  'teacher must read the active tenant hierarchy'
);
select pg_temp.assert_chapter_create_denied(
  '84000000-0000-4000-8000-000000000001',
  'Teacher denied'
);
select pg_temp.assert_lesson_update_denied(
  :'owner_lesson_one'::uuid,
  'Teacher denied'
);
reset role;

set local role authenticated;
select set_config('request.jwt.claim.sub', '81000000-0000-4000-8000-000000000004', true);
select pg_temp.assert_true(
  (select count(*) = 2 from public.chapters)
  and (select count(*) = 3 from public.lessons),
  'reviewer must read the active tenant hierarchy'
);
select pg_temp.assert_chapter_create_denied(
  '84000000-0000-4000-8000-000000000001',
  'Reviewer denied'
);
select pg_temp.assert_lesson_update_denied(
  :'owner_lesson_one'::uuid,
  'Reviewer denied'
);
reset role;

-- Another tenant cannot see or mutate tenant A hierarchy.
set local role authenticated;
select set_config('request.jwt.claim.sub', '81000000-0000-4000-8000-000000000005', true);
select pg_temp.assert_true(
  (select count(*) = 0 from public.curriculums)
  and (select count(*) = 0 from public.curriculum_versions)
  and (select count(*) = 0 from public.chapters)
  and (select count(*) = 0 from public.lessons),
  'another tenant must not see any hierarchy rows'
);
select pg_temp.assert_chapter_create_denied(
  '84000000-0000-4000-8000-000000000001',
  'Cross tenant denied'
);
select pg_temp.assert_lesson_update_denied(
  :'owner_lesson_one'::uuid,
  'Cross tenant denied'
);
reset role;

-- Owner deletes a lesson and then a chapter; ordering remains contiguous.
set local role authenticated;
select set_config('request.jwt.claim.sub', '81000000-0000-4000-8000-000000000001', true);
select public.delete_lesson(:'owner_lesson_two'::uuid);
select public.delete_chapter(:'owner_chapter_two'::uuid);
select pg_temp.assert_true(
  (select count(*) = 1 and min(order_no) = 1 and max(order_no) = 1 from public.chapters)
  and (select count(*) = 1 and min(order_no) = 1 and max(order_no) = 1 from public.lessons),
  'deletes must remove nested rows and compact order'
);
reset role;

set local role anon;
select set_config('request.jwt.claim.sub', '', true);
select pg_temp.assert_true(
  not has_table_privilege('anon', 'public.chapters', 'select')
  and not has_table_privilege('anon', 'public.lessons', 'select'),
  'anonymous role must not have hierarchy read privileges'
);
reset role;

select 'Sprint 8 curriculum editor RLS acceptance passed' as result;

rollback;
