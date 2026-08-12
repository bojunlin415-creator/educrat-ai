-- S8V-001 forward-only hardening for the applied Classes & Students foundation.
-- Keeps legacy learner/enrollment structures intact and applies only to Sprint 8 tables.

create or replace function public.can_manage_class_student_membership(
  p_organization_id uuid,
  p_class_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.classes as managed_class
    where managed_class.id = p_class_id
      and managed_class.organization_id = p_organization_id
      and managed_class.status = 'active'
      and (
        public.has_organization_role(
          p_organization_id,
          array['organization_owner', 'organization_admin']::text[]
        )
        or (
          managed_class.teacher_id = auth.uid()
          and public.has_organization_role(
            p_organization_id,
            array['teacher']::text[]
          )
        )
      )
  );
$$;

revoke all on function public.can_manage_class_student_membership(uuid, uuid)
from public, anon;
grant execute on function public.can_manage_class_student_membership(uuid, uuid)
to authenticated;

revoke all privileges on table public.classes from authenticated;
grant select on table public.classes to authenticated;
grant insert (
  organization_id, name, code, description, school_year, semester,
  subject, grade, teacher_id, school
) on table public.classes to authenticated;
grant update (
  name, code, description, school_year, semester, subject, grade,
  teacher_id, status, school
) on table public.classes to authenticated;

revoke all privileges on table public.students from authenticated;
grant select on table public.students to authenticated;
grant insert (
  organization_id, student_no, name, english_name, gender, birthday,
  school, grade
) on table public.students to authenticated;
grant update (
  student_no, name, english_name, gender, birthday, school, grade, status
) on table public.students to authenticated;

revoke all privileges on table public.student_class_members from authenticated;
grant select on table public.student_class_members to authenticated;
grant insert (
  organization_id, class_id, student_id, joined_at, left_at, status
) on table public.student_class_members to authenticated;
grant update (joined_at, left_at, status)
on table public.student_class_members to authenticated;

revoke insert on table public.class_student_audit_events from authenticated;
drop policy if exists "class_student_audit_insert_staff"
on public.class_student_audit_events;

create or replace function public.audit_class_roster_mutation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  audit_action text;
  actor uuid := auth.uid();
begin
  if actor is null then
    raise exception using errcode = '42501', message = 'authentication_required';
  end if;

  if tg_op = 'UPDATE'
    and (to_jsonb(old) - 'updated_at')
      is not distinct from (to_jsonb(new) - 'updated_at') then
    return new;
  end if;

  if tg_op = 'INSERT' then
    audit_action := 'CLASS_CREATED';
  elsif old.status <> 'archived' and new.status = 'archived' then
    audit_action := 'CLASS_ARCHIVED';
  elsif old.status = 'archived' and new.status <> 'archived' then
    audit_action := 'CLASS_RESTORED';
  else
    audit_action := 'CLASS_UPDATED';
  end if;

  insert into public.class_student_audit_events (
    organization_id, actor_id, target_type, target_id, action, metadata
  ) values (
    new.organization_id, actor, 'class', new.id, audit_action, '{}'::jsonb
  );

  insert into public.classroom_audit_events (
    organization_id, class_id, actor_id, action, metadata
  ) values (
    new.organization_id,
    new.id,
    actor,
    case when audit_action = 'CLASS_RESTORED'
      then 'CLASS_UPDATED'
      else audit_action
    end,
    case when audit_action = 'CLASS_RESTORED'
      then jsonb_build_object('transition', 'archived_to_active')
      else '{}'::jsonb
    end
  );
  return new;
end;
$$;

create or replace function public.audit_student_roster_mutation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  audit_action text;
  actor uuid := auth.uid();
begin
  if actor is null then
    raise exception using errcode = '42501', message = 'authentication_required';
  end if;

  if tg_op = 'UPDATE'
    and (to_jsonb(old) - 'updated_at')
      is not distinct from (to_jsonb(new) - 'updated_at') then
    return new;
  end if;

  if tg_op = 'INSERT' then
    audit_action := 'STUDENT_CREATED';
  elsif old.status = 'active' and new.status = 'archived' then
    audit_action := 'STUDENT_ARCHIVED';
  elsif old.status = 'archived' and new.status = 'active' then
    audit_action := 'STUDENT_RESTORED';
  else
    audit_action := 'STUDENT_UPDATED';
  end if;

  insert into public.class_student_audit_events (
    organization_id, actor_id, target_type, target_id, action, metadata
  ) values (
    new.organization_id, actor, 'student', new.id, audit_action, '{}'::jsonb
  );
  return new;
end;
$$;

create or replace function public.audit_student_class_membership_mutation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  audit_action text;
  actor uuid := auth.uid();
begin
  if actor is null then
    raise exception using errcode = '42501', message = 'authentication_required';
  end if;

  if tg_op = 'UPDATE' and old.status is not distinct from new.status then
    return new;
  end if;

  audit_action := case
    when new.status = 'active' then 'STUDENT_ASSIGNED'
    else 'STUDENT_REMOVED'
  end;

  insert into public.class_student_audit_events (
    organization_id, actor_id, target_type, target_id, action, metadata
  ) values (
    new.organization_id,
    actor,
    'membership',
    new.id,
    audit_action,
    jsonb_build_object('classId', new.class_id, 'studentId', new.student_id)
  );
  return new;
end;
$$;

revoke all on function public.audit_class_roster_mutation()
from public, anon, authenticated, service_role;
revoke all on function public.audit_student_roster_mutation()
from public, anon, authenticated, service_role;
revoke all on function public.audit_student_class_membership_mutation()
from public, anon, authenticated, service_role;

drop trigger if exists classes_write_roster_audit on public.classes;
create trigger classes_write_roster_audit
after insert or update on public.classes
for each row execute function public.audit_class_roster_mutation();

drop trigger if exists students_write_roster_audit on public.students;
create trigger students_write_roster_audit
after insert or update on public.students
for each row execute function public.audit_student_roster_mutation();

drop trigger if exists student_class_members_write_roster_audit
on public.student_class_members;
create trigger student_class_members_write_roster_audit
after insert or update of status on public.student_class_members
for each row execute function public.audit_student_class_membership_mutation();
