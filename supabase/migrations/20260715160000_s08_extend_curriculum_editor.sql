-- Sprint 8: Curriculum Editor chapter and lesson mutations.
-- This additive migration extends the Sprint 7 hierarchy without creating new
-- core tables, changing existing tenant boundaries, or enabling version 2.

alter table public.chapters
add column status text not null default 'draft' check (
  status in ('draft', 'active', 'archived')
);

alter table public.lessons
add column teaching_notes text check (
  teaching_notes is null or (
    teaching_notes = btrim(teaching_notes)
    and char_length(teaching_notes) <= 5000
  )
);

comment on column public.chapters.status is
  'Chapter editorial state. Active is presented as published in the Sprint 8 editor.';
comment on column public.lessons.teaching_notes is
  'Organization-private teaching notes for the lesson.';

create or replace function public.create_chapter(
  p_curriculum_version_id uuid,
  p_chapter_no integer,
  p_title text,
  p_description text default null,
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
  v_chapter_id uuid;
  v_order_no integer;
begin
  if v_user_id is null then
    raise exception using errcode = '42501', message = 'authentication_required';
  end if;

  if p_chapter_no is null
    or p_chapter_no not between 1 and 9999
    or p_title is null
    or p_title <> btrim(p_title)
    or char_length(p_title) not between 1 and 160
    or (
      nullif(btrim(p_description), '') is not null
      and char_length(btrim(p_description)) > 3000
    )
    or p_status is null
    or p_status not in ('draft', 'active')
  then
    raise exception using errcode = '22023', message = 'invalid_chapter_input';
  end if;

  select curriculum.organization_id
  into v_organization_id
  from public.curriculum_versions as curriculum_version
  join public.curriculums as curriculum
    on curriculum.id = curriculum_version.curriculum_id
  where curriculum_version.id = p_curriculum_version_id
    and curriculum_version.version = 1;

  if v_organization_id is null
    or v_organization_id <> public.get_active_organization_id()
  then
    raise exception using errcode = 'P0002', message = 'curriculum_version_not_found';
  end if;

  if not public.has_organization_role(
    v_organization_id,
    array['organization_owner', 'organization_admin']::text[]
  ) then
    raise exception using errcode = '42501', message = 'curriculum_write_forbidden';
  end if;

  perform 1
  from public.curriculum_versions
  where id = p_curriculum_version_id
  for update;

  select coalesce(max(chapter.order_no), 0) + 1
  into v_order_no
  from public.chapters as chapter
  where chapter.curriculum_version_id = p_curriculum_version_id;

  insert into public.chapters (
    curriculum_version_id,
    chapter_no,
    title,
    description,
    status,
    order_no
  ) values (
    p_curriculum_version_id,
    p_chapter_no,
    p_title,
    nullif(btrim(p_description), ''),
    p_status,
    v_order_no
  ) returning id into v_chapter_id;

  update public.curriculums
  set updated_at = timezone('utc'::text, now())
  where organization_id = v_organization_id
    and id = (
      select curriculum_id
      from public.curriculum_versions
      where id = p_curriculum_version_id
    );

  return v_chapter_id;
exception
  when unique_violation then
    raise exception using errcode = '23505', message = 'chapter_conflict';
end;
$$;

create or replace function public.update_chapter(
  p_chapter_id uuid,
  p_chapter_no integer,
  p_title text,
  p_description text default null,
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

  if p_chapter_no is null
    or p_chapter_no not between 1 and 9999
    or p_title is null
    or p_title <> btrim(p_title)
    or char_length(p_title) not between 1 and 160
    or (
      nullif(btrim(p_description), '') is not null
      and char_length(btrim(p_description)) > 3000
    )
    or p_status is null
    or p_status not in ('draft', 'active')
  then
    raise exception using errcode = '22023', message = 'invalid_chapter_input';
  end if;

  select curriculum.organization_id, curriculum.id
  into v_organization_id, v_curriculum_id
  from public.chapters as chapter
  join public.curriculum_versions as curriculum_version
    on curriculum_version.id = chapter.curriculum_version_id
  join public.curriculums as curriculum
    on curriculum.id = curriculum_version.curriculum_id
  where chapter.id = p_chapter_id
    and curriculum_version.version = 1;

  if v_organization_id is null
    or v_organization_id <> public.get_active_organization_id()
  then
    raise exception using errcode = 'P0002', message = 'chapter_not_found';
  end if;

  if not public.has_organization_role(
    v_organization_id,
    array['organization_owner', 'organization_admin']::text[]
  ) then
    raise exception using errcode = '42501', message = 'curriculum_write_forbidden';
  end if;

  update public.chapters
  set
    chapter_no = p_chapter_no,
    title = p_title,
    description = nullif(btrim(p_description), ''),
    status = p_status
  where id = p_chapter_id;

  update public.curriculums
  set updated_at = timezone('utc'::text, now())
  where id = v_curriculum_id;

  return p_chapter_id;
exception
  when unique_violation then
    raise exception using errcode = '23505', message = 'chapter_conflict';
end;
$$;

create or replace function public.delete_chapter(p_chapter_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_organization_id uuid;
  v_curriculum_id uuid;
  v_curriculum_version_id uuid;
begin
  if v_user_id is null then
    raise exception using errcode = '42501', message = 'authentication_required';
  end if;

  select
    curriculum.organization_id,
    curriculum.id,
    curriculum_version.id
  into v_organization_id, v_curriculum_id, v_curriculum_version_id
  from public.chapters as chapter
  join public.curriculum_versions as curriculum_version
    on curriculum_version.id = chapter.curriculum_version_id
  join public.curriculums as curriculum
    on curriculum.id = curriculum_version.curriculum_id
  where chapter.id = p_chapter_id
    and curriculum_version.version = 1;

  if v_organization_id is null
    or v_organization_id <> public.get_active_organization_id()
  then
    raise exception using errcode = 'P0002', message = 'chapter_not_found';
  end if;

  if not public.has_organization_role(
    v_organization_id,
    array['organization_owner', 'organization_admin']::text[]
  ) then
    raise exception using errcode = '42501', message = 'curriculum_write_forbidden';
  end if;

  perform 1
  from public.curriculum_versions
  where id = v_curriculum_version_id
  for update;

  delete from public.lessons where chapter_id = p_chapter_id;
  delete from public.chapters where id = p_chapter_id;

  update public.chapters
  set order_no = order_no + 1000000
  where curriculum_version_id = v_curriculum_version_id;

  with ordered as (
    select
      chapter.id,
      row_number() over (order by chapter.order_no, chapter.id)::integer as order_no
    from public.chapters as chapter
    where chapter.curriculum_version_id = v_curriculum_version_id
  )
  update public.chapters as chapter
  set order_no = ordered.order_no
  from ordered
  where chapter.id = ordered.id;

  update public.curriculums
  set updated_at = timezone('utc'::text, now())
  where id = v_curriculum_id;

  return p_chapter_id;
end;
$$;

create or replace function public.reorder_chapters(
  p_curriculum_version_id uuid,
  p_ordered_ids uuid[]
)
returns uuid[]
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_organization_id uuid;
  v_curriculum_id uuid;
  v_expected_count integer;
begin
  if v_user_id is null then
    raise exception using errcode = '42501', message = 'authentication_required';
  end if;

  if p_ordered_ids is null
    or cardinality(p_ordered_ids) not between 1 and 500
    or cardinality(p_ordered_ids) <> (
      select count(distinct ordered_id)
      from unnest(p_ordered_ids) as ordered(ordered_id)
    )
  then
    raise exception using errcode = '22023', message = 'invalid_chapter_order';
  end if;

  select curriculum.organization_id, curriculum.id
  into v_organization_id, v_curriculum_id
  from public.curriculum_versions as curriculum_version
  join public.curriculums as curriculum
    on curriculum.id = curriculum_version.curriculum_id
  where curriculum_version.id = p_curriculum_version_id
    and curriculum_version.version = 1;

  if v_organization_id is null
    or v_organization_id <> public.get_active_organization_id()
  then
    raise exception using errcode = 'P0002', message = 'curriculum_version_not_found';
  end if;

  if not public.has_organization_role(
    v_organization_id,
    array['organization_owner', 'organization_admin']::text[]
  ) then
    raise exception using errcode = '42501', message = 'curriculum_write_forbidden';
  end if;

  perform 1
  from public.curriculum_versions
  where id = p_curriculum_version_id
  for update;

  select count(*) into v_expected_count
  from public.chapters
  where curriculum_version_id = p_curriculum_version_id;

  if v_expected_count <> cardinality(p_ordered_ids)
    or exists (
      select 1
      from unnest(p_ordered_ids) as ordered(ordered_id)
      where not exists (
        select 1
        from public.chapters as chapter
        where chapter.id = ordered_id
          and chapter.curriculum_version_id = p_curriculum_version_id
      )
    )
  then
    raise exception using errcode = '22023', message = 'invalid_chapter_order';
  end if;

  update public.chapters
  set order_no = order_no + 1000000
  where curriculum_version_id = p_curriculum_version_id;

  update public.chapters as chapter
  set order_no = ordered.order_no::integer
  from unnest(p_ordered_ids) with ordinality as ordered(id, order_no)
  where chapter.id = ordered.id;

  update public.curriculums
  set updated_at = timezone('utc'::text, now())
  where id = v_curriculum_id;

  return p_ordered_ids;
end;
$$;

create or replace function public.create_lesson(
  p_chapter_id uuid,
  p_lesson_no integer,
  p_title text,
  p_learning_objectives text[] default '{}'::text[],
  p_estimated_minutes integer default null,
  p_teaching_notes text default null,
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
  v_lesson_id uuid;
  v_order_no integer;
begin
  if v_user_id is null then
    raise exception using errcode = '42501', message = 'authentication_required';
  end if;

  if p_lesson_no is null
    or p_lesson_no not between 1 and 9999
    or p_title is null
    or p_title <> btrim(p_title)
    or char_length(p_title) not between 1 and 160
    or p_learning_objectives is null
    or cardinality(p_learning_objectives) > 30
    or exists (
      select 1
      from unnest(p_learning_objectives) as objective
      where objective <> btrim(objective)
        or char_length(objective) not between 1 and 300
    )
    or (
      p_estimated_minutes is not null
      and p_estimated_minutes not between 1 and 600
    )
    or (
      nullif(btrim(p_teaching_notes), '') is not null
      and char_length(btrim(p_teaching_notes)) > 5000
    )
    or p_status is null
    or p_status not in ('draft', 'active')
  then
    raise exception using errcode = '22023', message = 'invalid_lesson_input';
  end if;

  select curriculum.organization_id, curriculum.id
  into v_organization_id, v_curriculum_id
  from public.chapters as chapter
  join public.curriculum_versions as curriculum_version
    on curriculum_version.id = chapter.curriculum_version_id
  join public.curriculums as curriculum
    on curriculum.id = curriculum_version.curriculum_id
  where chapter.id = p_chapter_id
    and curriculum_version.version = 1;

  if v_organization_id is null
    or v_organization_id <> public.get_active_organization_id()
  then
    raise exception using errcode = 'P0002', message = 'chapter_not_found';
  end if;

  if not public.has_organization_role(
    v_organization_id,
    array['organization_owner', 'organization_admin']::text[]
  ) then
    raise exception using errcode = '42501', message = 'curriculum_write_forbidden';
  end if;

  perform 1 from public.chapters where id = p_chapter_id for update;

  select coalesce(max(lesson.order_no), 0) + 1
  into v_order_no
  from public.lessons as lesson
  where lesson.chapter_id = p_chapter_id;

  insert into public.lessons (
    chapter_id,
    lesson_no,
    title,
    learning_objectives,
    estimated_minutes,
    teaching_notes,
    status,
    order_no
  ) values (
    p_chapter_id,
    p_lesson_no,
    p_title,
    p_learning_objectives,
    p_estimated_minutes,
    nullif(btrim(p_teaching_notes), ''),
    p_status,
    v_order_no
  ) returning id into v_lesson_id;

  update public.curriculums
  set updated_at = timezone('utc'::text, now())
  where id = v_curriculum_id;

  return v_lesson_id;
exception
  when unique_violation then
    raise exception using errcode = '23505', message = 'lesson_conflict';
end;
$$;

create or replace function public.update_lesson(
  p_lesson_id uuid,
  p_lesson_no integer,
  p_title text,
  p_learning_objectives text[] default '{}'::text[],
  p_estimated_minutes integer default null,
  p_teaching_notes text default null,
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

  if p_lesson_no is null
    or p_lesson_no not between 1 and 9999
    or p_title is null
    or p_title <> btrim(p_title)
    or char_length(p_title) not between 1 and 160
    or p_learning_objectives is null
    or cardinality(p_learning_objectives) > 30
    or exists (
      select 1
      from unnest(p_learning_objectives) as objective
      where objective <> btrim(objective)
        or char_length(objective) not between 1 and 300
    )
    or (
      p_estimated_minutes is not null
      and p_estimated_minutes not between 1 and 600
    )
    or (
      nullif(btrim(p_teaching_notes), '') is not null
      and char_length(btrim(p_teaching_notes)) > 5000
    )
    or p_status is null
    or p_status not in ('draft', 'active')
  then
    raise exception using errcode = '22023', message = 'invalid_lesson_input';
  end if;

  select curriculum.organization_id, curriculum.id
  into v_organization_id, v_curriculum_id
  from public.lessons as lesson
  join public.chapters as chapter on chapter.id = lesson.chapter_id
  join public.curriculum_versions as curriculum_version
    on curriculum_version.id = chapter.curriculum_version_id
  join public.curriculums as curriculum
    on curriculum.id = curriculum_version.curriculum_id
  where lesson.id = p_lesson_id
    and curriculum_version.version = 1;

  if v_organization_id is null
    or v_organization_id <> public.get_active_organization_id()
  then
    raise exception using errcode = 'P0002', message = 'lesson_not_found';
  end if;

  if not public.has_organization_role(
    v_organization_id,
    array['organization_owner', 'organization_admin']::text[]
  ) then
    raise exception using errcode = '42501', message = 'curriculum_write_forbidden';
  end if;

  update public.lessons
  set
    lesson_no = p_lesson_no,
    title = p_title,
    learning_objectives = p_learning_objectives,
    estimated_minutes = p_estimated_minutes,
    teaching_notes = nullif(btrim(p_teaching_notes), ''),
    status = p_status
  where id = p_lesson_id;

  update public.curriculums
  set updated_at = timezone('utc'::text, now())
  where id = v_curriculum_id;

  return p_lesson_id;
exception
  when unique_violation then
    raise exception using errcode = '23505', message = 'lesson_conflict';
end;
$$;

create or replace function public.delete_lesson(p_lesson_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_organization_id uuid;
  v_curriculum_id uuid;
  v_chapter_id uuid;
begin
  if v_user_id is null then
    raise exception using errcode = '42501', message = 'authentication_required';
  end if;

  select curriculum.organization_id, curriculum.id, chapter.id
  into v_organization_id, v_curriculum_id, v_chapter_id
  from public.lessons as lesson
  join public.chapters as chapter on chapter.id = lesson.chapter_id
  join public.curriculum_versions as curriculum_version
    on curriculum_version.id = chapter.curriculum_version_id
  join public.curriculums as curriculum
    on curriculum.id = curriculum_version.curriculum_id
  where lesson.id = p_lesson_id
    and curriculum_version.version = 1;

  if v_organization_id is null
    or v_organization_id <> public.get_active_organization_id()
  then
    raise exception using errcode = 'P0002', message = 'lesson_not_found';
  end if;

  if not public.has_organization_role(
    v_organization_id,
    array['organization_owner', 'organization_admin']::text[]
  ) then
    raise exception using errcode = '42501', message = 'curriculum_write_forbidden';
  end if;

  perform 1 from public.chapters where id = v_chapter_id for update;

  delete from public.lessons where id = p_lesson_id;

  update public.lessons
  set order_no = order_no + 1000000
  where chapter_id = v_chapter_id;

  with ordered as (
    select
      lesson.id,
      row_number() over (order by lesson.order_no, lesson.id)::integer as order_no
    from public.lessons as lesson
    where lesson.chapter_id = v_chapter_id
  )
  update public.lessons as lesson
  set order_no = ordered.order_no
  from ordered
  where lesson.id = ordered.id;

  update public.curriculums
  set updated_at = timezone('utc'::text, now())
  where id = v_curriculum_id;

  return p_lesson_id;
end;
$$;

create or replace function public.reorder_lessons(
  p_chapter_id uuid,
  p_ordered_ids uuid[]
)
returns uuid[]
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_organization_id uuid;
  v_curriculum_id uuid;
  v_expected_count integer;
begin
  if v_user_id is null then
    raise exception using errcode = '42501', message = 'authentication_required';
  end if;

  if p_ordered_ids is null
    or cardinality(p_ordered_ids) not between 1 and 500
    or cardinality(p_ordered_ids) <> (
      select count(distinct ordered_id)
      from unnest(p_ordered_ids) as ordered(ordered_id)
    )
  then
    raise exception using errcode = '22023', message = 'invalid_lesson_order';
  end if;

  select curriculum.organization_id, curriculum.id
  into v_organization_id, v_curriculum_id
  from public.chapters as chapter
  join public.curriculum_versions as curriculum_version
    on curriculum_version.id = chapter.curriculum_version_id
  join public.curriculums as curriculum
    on curriculum.id = curriculum_version.curriculum_id
  where chapter.id = p_chapter_id
    and curriculum_version.version = 1;

  if v_organization_id is null
    or v_organization_id <> public.get_active_organization_id()
  then
    raise exception using errcode = 'P0002', message = 'chapter_not_found';
  end if;

  if not public.has_organization_role(
    v_organization_id,
    array['organization_owner', 'organization_admin']::text[]
  ) then
    raise exception using errcode = '42501', message = 'curriculum_write_forbidden';
  end if;

  perform 1 from public.chapters where id = p_chapter_id for update;

  select count(*) into v_expected_count
  from public.lessons
  where chapter_id = p_chapter_id;

  if v_expected_count <> cardinality(p_ordered_ids)
    or exists (
      select 1
      from unnest(p_ordered_ids) as ordered(ordered_id)
      where not exists (
        select 1
        from public.lessons as lesson
        where lesson.id = ordered_id
          and lesson.chapter_id = p_chapter_id
      )
    )
  then
    raise exception using errcode = '22023', message = 'invalid_lesson_order';
  end if;

  update public.lessons
  set order_no = order_no + 1000000
  where chapter_id = p_chapter_id;

  update public.lessons as lesson
  set order_no = ordered.order_no::integer
  from unnest(p_ordered_ids) with ordinality as ordered(id, order_no)
  where lesson.id = ordered.id;

  update public.curriculums
  set updated_at = timezone('utc'::text, now())
  where id = v_curriculum_id;

  return p_ordered_ids;
end;
$$;

revoke all on function public.create_chapter(uuid, integer, text, text, text)
from public, anon, service_role;
revoke all on function public.update_chapter(uuid, integer, text, text, text)
from public, anon, service_role;
revoke all on function public.delete_chapter(uuid)
from public, anon, service_role;
revoke all on function public.reorder_chapters(uuid, uuid[])
from public, anon, service_role;
revoke all on function public.create_lesson(uuid, integer, text, text[], integer, text, text)
from public, anon, service_role;
revoke all on function public.update_lesson(uuid, integer, text, text[], integer, text, text)
from public, anon, service_role;
revoke all on function public.delete_lesson(uuid)
from public, anon, service_role;
revoke all on function public.reorder_lessons(uuid, uuid[])
from public, anon, service_role;

grant execute on function public.create_chapter(uuid, integer, text, text, text)
to authenticated;
grant execute on function public.update_chapter(uuid, integer, text, text, text)
to authenticated;
grant execute on function public.delete_chapter(uuid)
to authenticated;
grant execute on function public.reorder_chapters(uuid, uuid[])
to authenticated;
grant execute on function public.create_lesson(uuid, integer, text, text[], integer, text, text)
to authenticated;
grant execute on function public.update_lesson(uuid, integer, text, text[], integer, text, text)
to authenticated;
grant execute on function public.delete_lesson(uuid)
to authenticated;
grant execute on function public.reorder_lessons(uuid, uuid[])
to authenticated;

-- Direct chapter and lesson writes remain denied. Owner/admin mutations must use
-- the fixed-search-path RPCs above, which verify auth.uid(), active organization,
-- version 1, hierarchy ownership, complete reorder sets, and role on every call.
