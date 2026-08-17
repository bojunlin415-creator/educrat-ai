-- TD-001 Assignment dependency RLS recursion fix
-- Forward-only repair for assignment policies used by Teacher Dashboard.
-- Apply only to approved non-production environments after review.

create or replace function public.is_assignment_recipient(
  p_assignment_id uuid,
  p_organization_id uuid,
  p_student_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.assignment_students as student_assignment
    where student_assignment.assignment_id = p_assignment_id
      and student_assignment.organization_id = p_organization_id
      and student_assignment.student_id = p_student_id
  );
$$;

create or replace function public.is_assignment_manager(
  p_assignment_id uuid,
  p_organization_id uuid,
  p_actor_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.assignments as assignment
    where assignment.id = p_assignment_id
      and assignment.organization_id = p_organization_id
      and assignment.assigned_by = p_actor_id
  );
$$;

create or replace function public.assignment_belongs_to_organization(
  p_assignment_id uuid,
  p_organization_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.assignments as assignment
    where assignment.id = p_assignment_id
      and assignment.organization_id = p_organization_id
  );
$$;

create or replace function public.is_assignment_submission_eligible(
  p_assignment_id uuid,
  p_organization_id uuid,
  p_student_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.assignment_students as student_assignment
    where student_assignment.assignment_id = p_assignment_id
      and student_assignment.organization_id = p_organization_id
      and student_assignment.student_id = p_student_id
      and student_assignment.status in ('not_started', 'in_progress', 'overdue')
  );
$$;

revoke all on function public.is_assignment_recipient(uuid, uuid, uuid)
from public, anon;
revoke all on function public.is_assignment_manager(uuid, uuid, uuid)
from public, anon;
revoke all on function public.assignment_belongs_to_organization(uuid, uuid)
from public, anon;
revoke all on function public.is_assignment_submission_eligible(uuid, uuid, uuid)
from public, anon;

grant execute on function public.is_assignment_recipient(uuid, uuid, uuid)
to authenticated;
grant execute on function public.is_assignment_manager(uuid, uuid, uuid)
to authenticated;
grant execute on function public.assignment_belongs_to_organization(uuid, uuid)
to authenticated;
grant execute on function public.is_assignment_submission_eligible(uuid, uuid, uuid)
to authenticated;

drop policy if exists "assignments_select_member" on public.assignments;
drop policy if exists "assignment_students_select_scoped" on public.assignment_students;
drop policy if exists "assignment_students_insert_teacher" on public.assignment_students;
drop policy if exists "assignment_students_update_student_or_teacher" on public.assignment_students;
drop policy if exists "assignment_submissions_select_scoped" on public.assignment_submissions;
drop policy if exists "assignment_submissions_insert_student" on public.assignment_submissions;

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
    or public.is_assignment_recipient(
      assignments.id,
      assignments.organization_id,
      (select auth.uid())
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
  or public.is_assignment_manager(
    assignment_students.assignment_id,
    assignment_students.organization_id,
    (select auth.uid())
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
  and public.assignment_belongs_to_organization(
    assignment_students.assignment_id,
    assignment_students.organization_id
  )
  and (
    public.is_assignment_manager(
      assignment_students.assignment_id,
      assignment_students.organization_id,
      (select auth.uid())
    )
    or public.has_organization_role(
      organization_id,
      array['organization_owner', 'organization_admin']::text[]
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
  or public.is_assignment_manager(
    assignment_students.assignment_id,
    assignment_students.organization_id,
    (select auth.uid())
  )
)
with check (
  student_id = (select auth.uid())
  or public.has_organization_role(
    organization_id,
    array['organization_owner', 'organization_admin']::text[]
  )
  or public.is_assignment_manager(
    assignment_students.assignment_id,
    assignment_students.organization_id,
    (select auth.uid())
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
  or public.is_assignment_manager(
    assignment_submissions.assignment_id,
    assignment_submissions.organization_id,
    (select auth.uid())
  )
);

create policy "assignment_submissions_insert_student"
on public.assignment_submissions
for insert
to authenticated
with check (
  student_id = (select auth.uid())
  and public.is_assignment_submission_eligible(
    assignment_submissions.assignment_id,
    assignment_submissions.organization_id,
    (select auth.uid())
  )
);
