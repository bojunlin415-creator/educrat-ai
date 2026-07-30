-- CL-001 Class & Enrollment Foundation
-- Forward-only classroom, enrollment, and assignment-class integration.
-- Apply only to approved non-production environments after review.

create table public.classes (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  name text not null check (
    name = btrim(name) and char_length(name) between 2 and 120
  ),
  code text not null check (
    code = upper(btrim(code))
    and char_length(code) between 2 and 48
    and code ~ '^[A-Z0-9]+(?:-[A-Z0-9]+)*$'
  ),
  description text check (
    description is null or char_length(description) <= 1000
  ),
  school_year integer not null check (school_year between 100 and 999),
  semester smallint not null check (semester in (1, 2)),
  subject text not null check (
    subject = btrim(subject) and char_length(subject) between 1 and 80
  ),
  grade text not null check (
    grade = btrim(grade) and char_length(grade) between 1 and 80
  ),
  teacher_id uuid not null references public.profiles(id) on delete restrict,
  status text not null default 'active' check (
    status in ('active', 'inactive', 'archived')
  ),
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now()),
  constraint classes_code_unique unique (organization_id, code)
);

comment on table public.classes is
  'CL-001 class aggregate. Each class has one primary teacher.';
comment on column public.classes.teacher_id is
  'Primary teacher account/profile id. Assistant teachers are reserved for future packages.';

create table public.class_enrollments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  class_id uuid not null references public.classes(id) on delete cascade,
  student_id uuid not null references public.profiles(id) on delete restrict,
  joined_at timestamptz not null default timezone('utc'::text, now()),
  left_at timestamptz,
  status text not null default 'active' check (
    status in ('active', 'inactive', 'left')
  ),
  constraint class_enrollments_unique_student unique (class_id, student_id),
  constraint class_enrollments_left_at_required check (
    status <> 'left' or left_at is not null
  )
);

comment on table public.class_enrollments is
  'Student to class relationship. A student can belong to multiple classes in the same organization.';

create table public.assignment_classes (
  assignment_id uuid not null references public.assignments(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete restrict,
  class_id uuid not null references public.classes(id) on delete restrict,
  assigned_at timestamptz not null default timezone('utc'::text, now()),
  primary key (assignment_id, class_id)
);

comment on table public.assignment_classes is
  'CL-001 assignment class target materialization. Assignment remains bound to a fixed published curriculum version.';

create table public.classroom_audit_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  class_id uuid not null references public.classes(id) on delete restrict,
  actor_id uuid not null references auth.users(id) on delete restrict,
  action text not null check (
    action in (
      'CLASS_CREATED',
      'CLASS_UPDATED',
      'CLASS_ARCHIVED',
      'ENROLLMENT_CREATED',
      'ENROLLMENT_REMOVED'
    )
  ),
  metadata jsonb not null default '{}'::jsonb check (
    jsonb_typeof(metadata) = 'object'
  ),
  created_at timestamptz not null default timezone('utc'::text, now())
);

comment on table public.classroom_audit_events is
  'CL-001 classroom audit foundation. Does not store learning analytics, attendance, or timetable data.';

create index classes_teacher_idx
on public.classes (organization_id, teacher_id, status, updated_at desc);

create index classes_status_idx
on public.classes (organization_id, status, school_year desc, semester);

create index class_enrollments_student_idx
on public.class_enrollments (organization_id, student_id, status, joined_at desc);

create index class_enrollments_class_idx
on public.class_enrollments (organization_id, class_id, status);

create index assignment_classes_class_idx
on public.assignment_classes (organization_id, class_id, assigned_at desc);

create index classroom_audit_events_class_idx
on public.classroom_audit_events (organization_id, class_id, created_at desc);

create trigger classes_set_updated_at
before update on public.classes
for each row
execute function public.set_updated_at();

create or replace function public.validate_class_teacher()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1
    from public.organization_members as membership
    join public.organizations as organization
      on organization.id = membership.organization_id
    where membership.organization_id = new.organization_id
      and membership.user_id = new.teacher_id
      and membership.role = 'teacher'
      and membership.status = 'active'
      and organization.status = 'active'
      and organization.deleted_at is null
  ) then
    raise exception using errcode = '22023', message = 'class_invalid_teacher';
  end if;

  return new;
end;
$$;

create or replace function public.validate_class_enrollment()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1
    from public.classes as classroom
    where classroom.id = new.class_id
      and classroom.organization_id = new.organization_id
      and classroom.status <> 'archived'
  ) then
    raise exception using errcode = '22023', message = 'class_archived';
  end if;

  if not exists (
    select 1
    from public.organization_members as membership
    join public.organizations as organization
      on organization.id = membership.organization_id
    where membership.organization_id = new.organization_id
      and membership.user_id = new.student_id
      and membership.role = 'student'
      and membership.status = 'active'
      and organization.status = 'active'
      and organization.deleted_at is null
  ) then
    raise exception using errcode = '22023', message = 'class_invalid_student';
  end if;

  return new;
end;
$$;

create or replace function public.validate_assignment_class()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1
    from public.assignments as assignment
    join public.classes as classroom
      on classroom.id = new.class_id
    where assignment.id = new.assignment_id
      and assignment.organization_id = new.organization_id
      and classroom.organization_id = new.organization_id
      and classroom.status = 'active'
  ) then
    raise exception using errcode = '22023', message = 'assignment_invalid_class';
  end if;

  return new;
end;
$$;

revoke all on function public.validate_class_teacher() from public;
revoke all on function public.validate_class_enrollment() from public;
revoke all on function public.validate_assignment_class() from public;

create trigger classes_validate_teacher
before insert or update of organization_id, teacher_id
on public.classes
for each row
execute function public.validate_class_teacher();

create trigger class_enrollments_validate
before insert or update of organization_id, class_id, student_id, status
on public.class_enrollments
for each row
execute function public.validate_class_enrollment();

create trigger assignment_classes_validate
before insert or update of organization_id, assignment_id, class_id
on public.assignment_classes
for each row
execute function public.validate_assignment_class();

alter table public.classes enable row level security;
alter table public.classes force row level security;
alter table public.class_enrollments enable row level security;
alter table public.class_enrollments force row level security;
alter table public.assignment_classes enable row level security;
alter table public.assignment_classes force row level security;
alter table public.classroom_audit_events enable row level security;
alter table public.classroom_audit_events force row level security;

revoke all on table public.classes from anon, authenticated;
revoke all on table public.class_enrollments from anon, authenticated;
revoke all on table public.assignment_classes from anon, authenticated;
revoke all on table public.classroom_audit_events from anon, authenticated;

grant select, insert, update on table public.classes to authenticated;
grant select, insert, update on table public.class_enrollments to authenticated;
grant select, insert on table public.assignment_classes to authenticated;
grant select, insert on table public.classroom_audit_events to authenticated;

create policy "classes_select_scoped"
on public.classes
for select
to authenticated
using (
  public.has_organization_role(
    organization_id,
    array['organization_owner', 'organization_admin']::text[]
  )
  or teacher_id = (select auth.uid())
  or exists (
    select 1
    from public.class_enrollments as enrollment
    where enrollment.class_id = classes.id
      and enrollment.student_id = (select auth.uid())
      and enrollment.status = 'active'
  )
);

create policy "classes_insert_teacher"
on public.classes
for insert
to authenticated
with check (
  public.has_organization_role(
    organization_id,
    array['organization_owner', 'organization_admin']::text[]
  )
  or (
    teacher_id = (select auth.uid())
    and public.has_organization_role(
      organization_id,
      array['teacher']::text[]
    )
  )
);

create policy "classes_update_teacher"
on public.classes
for update
to authenticated
using (
  public.has_organization_role(
    organization_id,
    array['organization_owner', 'organization_admin']::text[]
  )
  or (
    teacher_id = (select auth.uid())
    and public.has_organization_role(
      organization_id,
      array['teacher']::text[]
    )
  )
)
with check (
  public.has_organization_role(
    organization_id,
    array['organization_owner', 'organization_admin']::text[]
  )
  or (
    teacher_id = (select auth.uid())
    and public.has_organization_role(
      organization_id,
      array['teacher']::text[]
    )
  )
);

create policy "class_enrollments_select_scoped"
on public.class_enrollments
for select
to authenticated
using (
  public.has_organization_role(
    organization_id,
    array['organization_owner', 'organization_admin']::text[]
  )
  or student_id = (select auth.uid())
  or exists (
    select 1
    from public.classes as classroom
    where classroom.id = class_enrollments.class_id
      and classroom.teacher_id = (select auth.uid())
  )
);

create policy "class_enrollments_insert_teacher"
on public.class_enrollments
for insert
to authenticated
with check (
  public.has_organization_role(
    organization_id,
    array['organization_owner', 'organization_admin']::text[]
  )
  or exists (
    select 1
    from public.classes as classroom
    where classroom.id = class_enrollments.class_id
      and classroom.organization_id = class_enrollments.organization_id
      and classroom.teacher_id = (select auth.uid())
  )
);

create policy "class_enrollments_update_teacher"
on public.class_enrollments
for update
to authenticated
using (
  public.has_organization_role(
    organization_id,
    array['organization_owner', 'organization_admin']::text[]
  )
  or exists (
    select 1
    from public.classes as classroom
    where classroom.id = class_enrollments.class_id
      and classroom.teacher_id = (select auth.uid())
  )
)
with check (
  public.has_organization_role(
    organization_id,
    array['organization_owner', 'organization_admin']::text[]
  )
  or exists (
    select 1
    from public.classes as classroom
    where classroom.id = class_enrollments.class_id
      and classroom.teacher_id = (select auth.uid())
  )
);

create policy "assignment_classes_select_scoped"
on public.assignment_classes
for select
to authenticated
using (
  public.has_organization_role(
    organization_id,
    array['organization_owner', 'organization_admin']::text[]
  )
  or exists (
    select 1
    from public.classes as classroom
    where classroom.id = assignment_classes.class_id
      and classroom.teacher_id = (select auth.uid())
  )
  or exists (
    select 1
    from public.class_enrollments as enrollment
    where enrollment.class_id = assignment_classes.class_id
      and enrollment.student_id = (select auth.uid())
      and enrollment.status = 'active'
  )
);

create policy "assignment_classes_insert_teacher"
on public.assignment_classes
for insert
to authenticated
with check (
  public.has_organization_role(
    organization_id,
    array['organization_owner', 'organization_admin']::text[]
  )
  or exists (
    select 1
    from public.classes as classroom
    where classroom.id = assignment_classes.class_id
      and classroom.organization_id = assignment_classes.organization_id
      and classroom.teacher_id = (select auth.uid())
  )
);

create policy "classroom_audit_select_admin"
on public.classroom_audit_events
for select
to authenticated
using (
  public.has_organization_role(
    organization_id,
    array['organization_owner', 'organization_admin']::text[]
  )
);

create policy "classroom_audit_insert_scoped"
on public.classroom_audit_events
for insert
to authenticated
with check (
  actor_id = (select auth.uid())
  and (
    (
      action in (
        'CLASS_CREATED',
        'CLASS_UPDATED',
        'CLASS_ARCHIVED',
        'ENROLLMENT_CREATED',
        'ENROLLMENT_REMOVED'
      )
      and public.has_organization_role(
        organization_id,
        array['organization_owner', 'organization_admin', 'teacher']::text[]
      )
    )
  )
);
