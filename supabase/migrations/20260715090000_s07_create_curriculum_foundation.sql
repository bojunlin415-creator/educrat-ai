-- Sprint 7: Curriculum Foundation.
-- This migration is additive and depends on the Sprint 6 organization
-- boundary. It intentionally does not create AI, question-bank, worksheet, or
-- storage resources.

create table public.subjects (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (
    code = lower(btrim(code))
    and code ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'
    and char_length(code) between 2 and 40
  ),
  name text not null unique check (
    name = btrim(name) and char_length(name) between 1 and 40
  ),
  display_order integer not null check (display_order >= 0),
  status text not null default 'active' check (status in ('active', 'inactive')),
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now())
);

create table public.grades (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (
    code = lower(btrim(code))
    and code ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'
    and char_length(code) between 1 and 40
  ),
  name text not null unique check (
    name = btrim(name) and char_length(name) between 1 and 40
  ),
  display_order integer not null unique check (display_order between 1 and 12),
  status text not null default 'active' check (status in ('active', 'inactive')),
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now())
);

create table public.publishers (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (
    code = lower(btrim(code))
    and code ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'
    and char_length(code) between 2 and 40
  ),
  name text not null unique check (
    name = btrim(name) and char_length(name) between 1 and 80
  ),
  display_order integer not null check (display_order >= 0),
  status text not null default 'active' check (status in ('active', 'inactive')),
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now())
);

create table public.curriculums (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  name text not null check (
    name = btrim(name) and char_length(name) between 2 and 120
  ),
  subject_id uuid not null references public.subjects(id) on delete restrict,
  grade_id uuid not null references public.grades(id) on delete restrict,
  publisher_id uuid not null references public.publishers(id) on delete restrict,
  school_year integer not null check (school_year between 100 and 999),
  semester smallint not null check (semester in (1, 2)),
  status text not null default 'draft' check (
    status in ('draft', 'active', 'archived')
  ),
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now())
);

create table public.curriculum_versions (
  id uuid primary key default gen_random_uuid(),
  curriculum_id uuid not null references public.curriculums(id) on delete restrict,
  version integer not null check (version between 1 and 9999),
  published_at timestamptz,
  status text not null default 'draft' check (
    status in ('draft', 'published', 'archived')
  ),
  remark text check (
    remark is null or (
      remark = btrim(remark) and char_length(remark) <= 1000
    )
  ),
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now()),
  constraint curriculum_versions_unique_version unique (curriculum_id, version),
  constraint curriculum_versions_published_at check (
    status <> 'published' or published_at is not null
  )
);

create table public.chapters (
  id uuid primary key default gen_random_uuid(),
  curriculum_version_id uuid not null references public.curriculum_versions(id) on delete restrict,
  chapter_no integer not null check (chapter_no > 0),
  title text not null check (
    title = btrim(title) and char_length(title) between 1 and 160
  ),
  description text check (
    description is null or (
      description = btrim(description) and char_length(description) <= 3000
    )
  ),
  order_no integer not null check (order_no > 0),
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now()),
  constraint chapters_unique_number unique (curriculum_version_id, chapter_no),
  constraint chapters_unique_order unique (curriculum_version_id, order_no)
);

create table public.lessons (
  id uuid primary key default gen_random_uuid(),
  chapter_id uuid not null references public.chapters(id) on delete restrict,
  lesson_no integer not null check (lesson_no > 0),
  title text not null check (
    title = btrim(title) and char_length(title) between 1 and 160
  ),
  learning_objectives text[] not null default '{}'::text[],
  estimated_minutes integer check (estimated_minutes between 1 and 600),
  order_no integer not null check (order_no > 0),
  status text not null default 'draft' check (
    status in ('draft', 'active', 'archived')
  ),
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now()),
  constraint lessons_unique_number unique (chapter_id, lesson_no),
  constraint lessons_unique_order unique (chapter_id, order_no),
  constraint lessons_objectives_count check (
    cardinality(learning_objectives) <= 30
  )
);

comment on table public.subjects is
  'Global curriculum subject reference data. Values are database-managed, not frontend enums.';
comment on table public.grades is
  'Global elementary grade reference data. Values are database-managed, not frontend enums.';
comment on table public.publishers is
  'Extensible publisher progress references. Publisher names do not imply authorization or endorsement.';
comment on table public.curriculums is
  'Organization-owned curriculum metadata and tenant boundary.';
comment on table public.curriculum_versions is
  'Immutable curriculum revision history. Existing versions are never overwritten.';
comment on table public.chapters is
  'Ordered chapter structure within a curriculum version.';
comment on table public.lessons is
  'Ordered lesson structure within a chapter.';

create unique index curriculums_unique_name_per_organization_idx
on public.curriculums (organization_id, lower(name));

create index curriculums_organization_recent_idx
on public.curriculums (organization_id, updated_at desc);

create index curriculums_reference_filter_idx
on public.curriculums (organization_id, subject_id, grade_id, publisher_id);

create index curriculum_versions_curriculum_recent_idx
on public.curriculum_versions (curriculum_id, version desc);

create index chapters_version_order_idx
on public.chapters (curriculum_version_id, order_no);

create index lessons_chapter_order_idx
on public.lessons (chapter_id, order_no);

create trigger subjects_set_updated_at
before update on public.subjects
for each row execute function public.set_updated_at();

create trigger grades_set_updated_at
before update on public.grades
for each row execute function public.set_updated_at();

create trigger publishers_set_updated_at
before update on public.publishers
for each row execute function public.set_updated_at();

create trigger curriculums_set_updated_at
before update on public.curriculums
for each row execute function public.set_updated_at();

create trigger curriculum_versions_set_updated_at
before update on public.curriculum_versions
for each row execute function public.set_updated_at();

create trigger chapters_set_updated_at
before update on public.chapters
for each row execute function public.set_updated_at();

create trigger lessons_set_updated_at
before update on public.lessons
for each row execute function public.set_updated_at();

alter table public.subjects enable row level security;
alter table public.subjects force row level security;
alter table public.grades enable row level security;
alter table public.grades force row level security;
alter table public.publishers enable row level security;
alter table public.publishers force row level security;
alter table public.curriculums enable row level security;
alter table public.curriculums force row level security;
alter table public.curriculum_versions enable row level security;
alter table public.curriculum_versions force row level security;
alter table public.chapters enable row level security;
alter table public.chapters force row level security;
alter table public.lessons enable row level security;
alter table public.lessons force row level security;

revoke all on table public.subjects from anon, authenticated;
revoke all on table public.grades from anon, authenticated;
revoke all on table public.publishers from anon, authenticated;
revoke all on table public.curriculums from anon, authenticated;
revoke all on table public.curriculum_versions from anon, authenticated;
revoke all on table public.chapters from anon, authenticated;
revoke all on table public.lessons from anon, authenticated;

grant select on table public.subjects to authenticated;
grant select on table public.grades to authenticated;
grant select on table public.publishers to authenticated;
grant select on table public.curriculums to authenticated;
grant update (
  name,
  subject_id,
  grade_id,
  publisher_id,
  school_year,
  semester,
  status
) on table public.curriculums to authenticated;
grant select on table public.curriculum_versions to authenticated;
grant select on table public.chapters to authenticated;
grant select on table public.lessons to authenticated;

create policy "subjects_select_authenticated_member"
on public.subjects
for select
to authenticated
using (public.get_active_organization_id() is not null);

create policy "grades_select_authenticated_member"
on public.grades
for select
to authenticated
using (public.get_active_organization_id() is not null);

create policy "publishers_select_authenticated_member"
on public.publishers
for select
to authenticated
using (public.get_active_organization_id() is not null);

create policy "curriculums_select_active_organization"
on public.curriculums
for select
to authenticated
using (
  organization_id = public.get_active_organization_id()
  and public.is_active_organization_member(organization_id)
);

create policy "curriculums_update_active_organization_admin"
on public.curriculums
for update
to authenticated
using (
  organization_id = public.get_active_organization_id()
  and public.has_organization_role(
    organization_id,
    array['organization_owner', 'organization_admin']::text[]
  )
)
with check (
  organization_id = public.get_active_organization_id()
  and public.has_organization_role(
    organization_id,
    array['organization_owner', 'organization_admin']::text[]
  )
);

create policy "curriculum_versions_select_active_organization"
on public.curriculum_versions
for select
to authenticated
using (
  exists (
    select 1
    from public.curriculums as curriculum
    where curriculum.id = curriculum_id
      and curriculum.organization_id = public.get_active_organization_id()
      and public.is_active_organization_member(curriculum.organization_id)
  )
);

create policy "chapters_select_active_organization"
on public.chapters
for select
to authenticated
using (
  exists (
    select 1
    from public.curriculum_versions as curriculum_version
    join public.curriculums as curriculum
      on curriculum.id = curriculum_version.curriculum_id
    where curriculum_version.id = curriculum_version_id
      and curriculum.organization_id = public.get_active_organization_id()
      and public.is_active_organization_member(curriculum.organization_id)
  )
);

create policy "lessons_select_active_organization"
on public.lessons
for select
to authenticated
using (
  exists (
    select 1
    from public.chapters as chapter
    join public.curriculum_versions as curriculum_version
      on curriculum_version.id = chapter.curriculum_version_id
    join public.curriculums as curriculum
      on curriculum.id = curriculum_version.curriculum_id
    where chapter.id = chapter_id
      and curriculum.organization_id = public.get_active_organization_id()
      and public.is_active_organization_member(curriculum.organization_id)
  )
);

create or replace function public.create_curriculum_with_initial_version(
  p_name text,
  p_subject_id uuid,
  p_grade_id uuid,
  p_publisher_id uuid,
  p_school_year integer,
  p_semester smallint,
  p_status text default 'draft',
  p_version integer default 1,
  p_version_remark text default null
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
    or p_status is null
    or p_status not in ('draft', 'active')
    or p_version is null
    or p_version not between 1 and 9999
    or (
      nullif(btrim(p_version_remark), '') is not null
      and char_length(btrim(p_version_remark)) > 1000
    )
  then
    raise exception using errcode = '22023', message = 'invalid_curriculum_input';
  end if;

  if not exists (
    select 1 from public.subjects
    where id = p_subject_id and status = 'active'
  ) or not exists (
    select 1 from public.grades
    where id = p_grade_id and status = 'active'
  ) or not exists (
    select 1 from public.publishers
    where id = p_publisher_id and status = 'active'
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
  ) values (
    v_organization_id,
    p_name,
    p_subject_id,
    p_grade_id,
    p_publisher_id,
    p_school_year,
    p_semester,
    p_status,
    v_user_id
  ) returning id into v_curriculum_id;

  insert into public.curriculum_versions (
    curriculum_id,
    version,
    status,
    remark
  ) values (
    v_curriculum_id,
    p_version,
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
  text,
  integer,
  text
) from public, anon;

grant execute on function public.create_curriculum_with_initial_version(
  text,
  uuid,
  uuid,
  uuid,
  integer,
  smallint,
  text,
  integer,
  text
) to authenticated;

insert into public.subjects (code, name, display_order) values
  ('chinese', '國語', 10),
  ('english', '英文', 20),
  ('math', '數學', 30),
  ('science', '自然', 40),
  ('social', '社會', 50),
  ('life', '生活', 60);

insert into public.grades (code, name, display_order) values
  ('1', '一年級', 1),
  ('2', '二年級', 2),
  ('3', '三年級', 3),
  ('4', '四年級', 4),
  ('5', '五年級', 5),
  ('6', '六年級', 6);

insert into public.publishers (code, name, display_order) values
  ('nan-yi', '南一', 10),
  ('kang-hsuan', '康軒', 20),
  ('han-lin', '翰林', 30);

-- No DELETE privilege or policy is created. Direct curriculum INSERT is also
-- denied; authenticated owner/admin callers must use the atomic RPC. Version,
-- chapter, and lesson mutation APIs are intentionally deferred beyond Sprint 7.
