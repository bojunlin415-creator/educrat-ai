-- Sprint 8 Classes & Students Foundation.
-- Forward-only and additive. Never apply automatically to production.

alter table public.classes
  add column if not exists school text;

alter table public.classes
  add constraint classes_school_length
  check (school is null or char_length(btrim(school)) between 1 and 160) not valid;

alter table public.classes validate constraint classes_school_length;

create unique index if not exists classes_id_organization_unique
on public.classes (id, organization_id);

create table public.students (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  student_no text not null check (
    student_no = btrim(student_no) and char_length(student_no) between 1 and 48
  ),
  name text not null check (
    name = btrim(name) and char_length(name) between 1 and 120
  ),
  english_name text check (
    english_name is null or char_length(btrim(english_name)) between 1 and 120
  ),
  gender text not null check (gender in ('female', 'male', 'non_binary', 'undisclosed')),
  birthday date,
  school text check (
    school is null or char_length(btrim(school)) between 1 and 160
  ),
  grade text not null check (
    grade = btrim(grade) and char_length(grade) between 1 and 80
  ),
  status text not null default 'active' check (status in ('active', 'archived')),
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now()),
  constraint students_number_unique unique (organization_id, student_no),
  constraint students_id_organization_unique unique (id, organization_id)
);

create table public.student_class_members (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  class_id uuid not null,
  student_id uuid not null,
  joined_at timestamptz not null default timezone('utc'::text, now()),
  left_at timestamptz,
  status text not null default 'active' check (status in ('active', 'left')),
  constraint student_class_members_unique unique (class_id, student_id),
  constraint student_class_members_class_tenant_fk
    foreign key (class_id, organization_id)
    references public.classes(id, organization_id) on delete restrict,
  constraint student_class_members_student_tenant_fk
    foreign key (student_id, organization_id)
    references public.students(id, organization_id) on delete restrict,
  constraint student_class_members_left_at check (
    status <> 'left' or left_at is not null
  )
);

create table public.class_student_audit_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  actor_id uuid not null references auth.users(id) on delete restrict,
  target_type text not null check (target_type in ('class', 'student', 'membership')),
  target_id uuid not null,
  action text not null check (action in (
    'CLASS_CREATED', 'CLASS_UPDATED', 'CLASS_ARCHIVED', 'CLASS_RESTORED',
    'STUDENT_CREATED', 'STUDENT_UPDATED', 'STUDENT_ARCHIVED', 'STUDENT_RESTORED',
    'STUDENT_ASSIGNED', 'STUDENT_REMOVED'
  )),
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object'),
  created_at timestamptz not null default timezone('utc'::text, now())
);

create index if not exists classes_organization_status_idx
on public.classes (organization_id, status, updated_at desc);
create index students_organization_status_idx
on public.students (organization_id, status, created_at desc);
create index students_number_idx
on public.students (organization_id, student_no);
create index student_class_members_class_status_idx
on public.student_class_members (organization_id, class_id, status);
create index student_class_members_student_status_idx
on public.student_class_members (organization_id, student_id, status);
create index class_student_audit_scope_idx
on public.class_student_audit_events (organization_id, created_at desc);

create trigger students_set_updated_at
before update on public.students
for each row execute function public.set_updated_at();

alter table public.students enable row level security;
alter table public.students force row level security;
alter table public.student_class_members enable row level security;
alter table public.student_class_members force row level security;
alter table public.class_student_audit_events enable row level security;
alter table public.class_student_audit_events force row level security;

revoke all on table public.students, public.student_class_members,
  public.class_student_audit_events from anon, authenticated;
grant select, insert, update on table public.students to authenticated;
grant select, insert, update on table public.student_class_members to authenticated;
grant select, insert on table public.class_student_audit_events to authenticated;

create policy "students_select_active_staff"
on public.students for select to authenticated
using (public.has_organization_role(
  organization_id,
  array['organization_owner', 'organization_admin', 'teacher']::text[]
));

create policy "students_manage_active_staff"
on public.students for all to authenticated
using (public.has_organization_role(
  organization_id,
  array['organization_owner', 'organization_admin', 'teacher']::text[]
))
with check (public.has_organization_role(
  organization_id,
  array['organization_owner', 'organization_admin', 'teacher']::text[]
));

create policy "student_class_members_select_active_staff"
on public.student_class_members for select to authenticated
using (public.has_organization_role(
  organization_id,
  array['organization_owner', 'organization_admin', 'teacher']::text[]
));

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
  select
    public.has_organization_role(
      p_organization_id,
      array['organization_owner', 'organization_admin']::text[]
    )
    or exists (
      select 1 from public.classes as managed_class
      where managed_class.id = p_class_id
        and managed_class.organization_id = p_organization_id
        and managed_class.teacher_id = auth.uid()
        and managed_class.status <> 'archived'
    );
$$;

revoke all on function public.can_manage_class_student_membership(uuid, uuid)
from public, anon;
grant execute on function public.can_manage_class_student_membership(uuid, uuid)
to authenticated;

create policy "student_class_members_manage_active_staff"
on public.student_class_members for all to authenticated
using (
  public.can_manage_class_student_membership(organization_id, class_id)
)
with check (
  public.can_manage_class_student_membership(organization_id, class_id)
);

create policy "class_student_audit_select_admin"
on public.class_student_audit_events for select to authenticated
using (public.has_organization_role(
  organization_id,
  array['organization_owner', 'organization_admin']::text[]
));

create policy "class_student_audit_insert_staff"
on public.class_student_audit_events for insert to authenticated
with check (
  actor_id = (select auth.uid())
  and public.has_organization_role(
    organization_id,
    array['organization_owner', 'organization_admin', 'teacher']::text[]
  )
);
