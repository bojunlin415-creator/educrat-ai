-- TD-001 Teacher Dashboard RLS recursion fix
-- Forward-only fix for CL-001 classroom policies used by Teacher Dashboard.
-- Apply only to approved non-production environments after review.

create or replace function public.is_class_primary_teacher(
  p_class_id uuid,
  p_organization_id uuid,
  p_teacher_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.classes as classroom
    where classroom.id = p_class_id
      and classroom.organization_id = p_organization_id
      and classroom.teacher_id = p_teacher_id
  );
$$;

create or replace function public.is_class_enrolled_student(
  p_class_id uuid,
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
    from public.class_enrollments as enrollment
    where enrollment.class_id = p_class_id
      and enrollment.organization_id = p_organization_id
      and enrollment.student_id = p_student_id
      and enrollment.status = 'active'
  );
$$;

revoke all on function public.is_class_primary_teacher(uuid, uuid, uuid)
from public, anon;
revoke all on function public.is_class_enrolled_student(uuid, uuid, uuid)
from public, anon;
grant execute on function public.is_class_primary_teacher(uuid, uuid, uuid)
to authenticated;
grant execute on function public.is_class_enrolled_student(uuid, uuid, uuid)
to authenticated;

drop policy if exists "classes_select_scoped" on public.classes;
drop policy if exists "class_enrollments_select_scoped" on public.class_enrollments;
drop policy if exists "class_enrollments_insert_teacher" on public.class_enrollments;
drop policy if exists "class_enrollments_update_teacher" on public.class_enrollments;
drop policy if exists "assignment_classes_select_scoped" on public.assignment_classes;
drop policy if exists "assignment_classes_insert_teacher" on public.assignment_classes;

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
  or public.is_class_enrolled_student(
    classes.id,
    classes.organization_id,
    (select auth.uid())
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
  or public.is_class_primary_teacher(
    class_enrollments.class_id,
    class_enrollments.organization_id,
    (select auth.uid())
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
  or public.is_class_primary_teacher(
    class_enrollments.class_id,
    class_enrollments.organization_id,
    (select auth.uid())
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
  or public.is_class_primary_teacher(
    class_enrollments.class_id,
    class_enrollments.organization_id,
    (select auth.uid())
  )
)
with check (
  public.has_organization_role(
    organization_id,
    array['organization_owner', 'organization_admin']::text[]
  )
  or public.is_class_primary_teacher(
    class_enrollments.class_id,
    class_enrollments.organization_id,
    (select auth.uid())
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
  or public.is_class_primary_teacher(
    assignment_classes.class_id,
    assignment_classes.organization_id,
    (select auth.uid())
  )
  or public.is_class_enrolled_student(
    assignment_classes.class_id,
    assignment_classes.organization_id,
    (select auth.uid())
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
  or public.is_class_primary_teacher(
    assignment_classes.class_id,
    assignment_classes.organization_id,
    (select auth.uid())
  )
);
