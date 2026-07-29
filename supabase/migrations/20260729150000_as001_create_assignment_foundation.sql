-- AS-001 Assignment Foundation
-- Forward-only assignment, student assignment, and submission foundation.
-- Apply only to approved non-production environments after review.

create table public.assignments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  curriculum_id uuid not null references public.curriculums(id) on delete restrict,
  curriculum_version_id uuid not null references public.curriculum_versions(id) on delete restrict,
  title text not null check (
    title = btrim(title) and char_length(title) between 2 and 120
  ),
  description text check (
    description is null or char_length(description) <= 1000
  ),
  assigned_by uuid not null references auth.users(id) on delete restrict,
  publish_at timestamptz not null,
  due_at timestamptz not null,
  status text not null default 'scheduled' check (
    status in ('draft', 'scheduled', 'active', 'cancelled', 'closed')
  ),
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now()),
  constraint assignments_due_after_publish check (due_at >= publish_at)
);

comment on table public.assignments is
  'AS-001 assignment aggregate. Each assignment is bound to one immutable curriculum version.';
comment on column public.assignments.curriculum_version_id is
  'Fixed curriculum version reference. Never resolves latest dynamically.';

create table public.assignment_students (
  assignment_id uuid not null references public.assignments(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete restrict,
  student_id uuid not null references public.profiles(id) on delete restrict,
  assigned_at timestamptz not null default timezone('utc'::text, now()),
  opened_at timestamptz,
  submitted_at timestamptz,
  status text not null default 'not_started' check (
    status in ('not_started', 'in_progress', 'submitted', 'overdue')
  ),
  primary key (assignment_id, student_id),
  constraint assignment_students_submitted_at_required check (
    status <> 'submitted' or submitted_at is not null
  )
);

comment on table public.assignment_students is
  'Student-specific assignment state. Class expansion is future work and must materialize into these rows.';

create table public.assignment_submissions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  assignment_id uuid not null references public.assignments(id) on delete cascade,
  student_id uuid not null references public.profiles(id) on delete restrict,
  content jsonb not null default '{}'::jsonb,
  status text not null default 'draft' check (status in ('draft', 'submitted')),
  submitted_at timestamptz,
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now()),
  constraint assignment_submissions_one_per_student unique (
    assignment_id,
    student_id
  ),
  constraint assignment_submissions_submitted_at_required check (
    status <> 'submitted' or submitted_at is not null
  ),
  constraint assignment_submissions_content_object check (
    jsonb_typeof(content) = 'object'
  )
);

comment on table public.assignment_submissions is
  'One submission per student per assignment. AI grading is intentionally not implemented in AS-001.';

create table public.assignment_audit_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  assignment_id uuid not null references public.assignments(id) on delete restrict,
  actor_id uuid not null references auth.users(id) on delete restrict,
  action text not null check (
    action in (
      'ASSIGNMENT_CREATED',
      'ASSIGNMENT_UPDATED',
      'ASSIGNMENT_ASSIGNED',
      'ASSIGNMENT_SUBMITTED'
    )
  ),
  metadata jsonb not null default '{}'::jsonb check (
    jsonb_typeof(metadata) = 'object'
  ),
  created_at timestamptz not null default timezone('utc'::text, now())
);

comment on table public.assignment_audit_events is
  'AS-001 assignment audit foundation. Does not store submission content or answers.';

create index assignments_organization_status_idx
on public.assignments (organization_id, status, publish_at desc);

create index assignments_curriculum_version_idx
on public.assignments (curriculum_version_id);

create index assignments_teacher_idx
on public.assignments (organization_id, assigned_by, publish_at desc);

create index assignment_students_student_idx
on public.assignment_students (organization_id, student_id, status, assigned_at desc);

create index assignment_submissions_student_idx
on public.assignment_submissions (organization_id, student_id, updated_at desc);

create index assignment_audit_events_assignment_idx
on public.assignment_audit_events (organization_id, assignment_id, created_at desc);

create trigger assignments_set_updated_at
before update on public.assignments
for each row
execute function public.set_updated_at();

create trigger assignment_submissions_set_updated_at
before update on public.assignment_submissions
for each row
execute function public.set_updated_at();

create or replace function public.validate_assignment_curriculum_version()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_curriculum_status text;
  v_version_status text;
  v_version_curriculum_id uuid;
  v_version_organization_id uuid;
begin
  select curriculum.status,
         version.status,
         version.curriculum_id,
         curriculum.organization_id
  into v_curriculum_status,
       v_version_status,
       v_version_curriculum_id,
       v_version_organization_id
  from public.curriculum_versions as version
  join public.curriculums as curriculum
    on curriculum.id = version.curriculum_id
  where version.id = new.curriculum_version_id
    and curriculum.id = new.curriculum_id
    and curriculum.deleted_at is null;

  if v_version_curriculum_id is null
    or v_version_curriculum_id <> new.curriculum_id
    or v_version_organization_id <> new.organization_id
    or v_curriculum_status <> 'published'
    or v_version_status <> 'published'
  then
    raise exception using
      errcode = '22023',
      message = 'assignment_invalid_curriculum_version';
  end if;

  if new.due_at < new.publish_at then
    raise exception using
      errcode = '22023',
      message = 'assignment_due_before_publish';
  end if;

  return new;
end;
$$;

revoke all on function public.validate_assignment_curriculum_version() from public;

create trigger assignments_validate_curriculum_version
before insert or update of curriculum_id, curriculum_version_id, organization_id, publish_at, due_at
on public.assignments
for each row
execute function public.validate_assignment_curriculum_version();

alter table public.assignments enable row level security;
alter table public.assignments force row level security;
alter table public.assignment_students enable row level security;
alter table public.assignment_students force row level security;
alter table public.assignment_submissions enable row level security;
alter table public.assignment_submissions force row level security;
alter table public.assignment_audit_events enable row level security;
alter table public.assignment_audit_events force row level security;

revoke all on table public.assignments from anon, authenticated;
revoke all on table public.assignment_students from anon, authenticated;
revoke all on table public.assignment_submissions from anon, authenticated;
revoke all on table public.assignment_audit_events from anon, authenticated;

grant select, insert, update on table public.assignments to authenticated;
grant select, insert, update on table public.assignment_students to authenticated;
grant select, insert, update on table public.assignment_submissions to authenticated;
grant select, insert on table public.assignment_audit_events to authenticated;

create policy "assignments_select_member"
on public.assignments
for select
to authenticated
using (
  public.is_active_organization_member(organization_id)
  and (
    public.has_organization_role(
      organization_id,
      array['organization_owner', 'organization_admin']::text[]
    )
    or assigned_by = (select auth.uid())
    or exists (
      select 1
      from public.assignment_students as student_assignment
      where student_assignment.assignment_id = assignments.id
        and student_assignment.student_id = (select auth.uid())
    )
  )
);

create policy "assignments_insert_teacher"
on public.assignments
for insert
to authenticated
with check (
  assigned_by = (select auth.uid())
  and public.has_organization_role(
    organization_id,
    array['organization_owner', 'organization_admin', 'teacher']::text[]
  )
);

create policy "assignments_update_teacher"
on public.assignments
for update
to authenticated
using (
  public.has_organization_role(
    organization_id,
    array['organization_owner', 'organization_admin']::text[]
  )
  or (
    assigned_by = (select auth.uid())
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
    assigned_by = (select auth.uid())
    and public.has_organization_role(
      organization_id,
      array['teacher']::text[]
    )
  )
);

create policy "assignment_students_select_scoped"
on public.assignment_students
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
    from public.assignments as assignment
    where assignment.id = assignment_students.assignment_id
      and assignment.assigned_by = (select auth.uid())
  )
);

create policy "assignment_students_insert_teacher"
on public.assignment_students
for insert
to authenticated
with check (
  public.has_organization_role(
    organization_id,
    array['organization_owner', 'organization_admin', 'teacher']::text[]
  )
  and exists (
    select 1
    from public.assignments as assignment
    where assignment.id = assignment_students.assignment_id
      and assignment.organization_id = assignment_students.organization_id
      and (
        assignment.assigned_by = (select auth.uid())
        or public.has_organization_role(
          organization_id,
          array['organization_owner', 'organization_admin']::text[]
        )
      )
  )
);

create policy "assignment_students_update_student_or_teacher"
on public.assignment_students
for update
to authenticated
using (
  student_id = (select auth.uid())
  or public.has_organization_role(
    organization_id,
    array['organization_owner', 'organization_admin']::text[]
  )
  or exists (
    select 1
    from public.assignments as assignment
    where assignment.id = assignment_students.assignment_id
      and assignment.assigned_by = (select auth.uid())
  )
)
with check (
  student_id = (select auth.uid())
  or public.has_organization_role(
    organization_id,
    array['organization_owner', 'organization_admin']::text[]
  )
  or exists (
    select 1
    from public.assignments as assignment
    where assignment.id = assignment_students.assignment_id
      and assignment.assigned_by = (select auth.uid())
  )
);

create policy "assignment_submissions_select_scoped"
on public.assignment_submissions
for select
to authenticated
using (
  student_id = (select auth.uid())
  or public.has_organization_role(
    organization_id,
    array['organization_owner', 'organization_admin']::text[]
  )
  or exists (
    select 1
    from public.assignments as assignment
    where assignment.id = assignment_submissions.assignment_id
      and assignment.assigned_by = (select auth.uid())
  )
);

create policy "assignment_submissions_insert_student"
on public.assignment_submissions
for insert
to authenticated
with check (
  student_id = (select auth.uid())
  and exists (
    select 1
    from public.assignment_students as student_assignment
    where student_assignment.assignment_id = assignment_submissions.assignment_id
      and student_assignment.student_id = (select auth.uid())
      and student_assignment.organization_id = assignment_submissions.organization_id
      and student_assignment.status in ('not_started', 'in_progress', 'overdue')
  )
);

create policy "assignment_submissions_update_student_draft"
on public.assignment_submissions
for update
to authenticated
using (
  student_id = (select auth.uid())
  and status = 'draft'
)
with check (
  student_id = (select auth.uid())
  and status in ('draft', 'submitted')
);

create policy "assignment_audit_select_admin"
on public.assignment_audit_events
for select
to authenticated
using (
  public.has_organization_role(
    organization_id,
    array['organization_owner', 'organization_admin']::text[]
  )
);

create policy "assignment_audit_insert_scoped"
on public.assignment_audit_events
for insert
to authenticated
with check (
  actor_id = (select auth.uid())
  and (
    (
      action in (
        'ASSIGNMENT_CREATED',
        'ASSIGNMENT_UPDATED',
        'ASSIGNMENT_ASSIGNED'
      )
      and public.has_organization_role(
        organization_id,
        array['organization_owner', 'organization_admin', 'teacher']::text[]
      )
    )
    or (
      action = 'ASSIGNMENT_SUBMITTED'
      and public.has_organization_role(
        organization_id,
        array['student']::text[]
      )
    )
  )
);
