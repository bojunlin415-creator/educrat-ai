-- AN-001 Student Learning Analytics Foundation
-- Forward-only learning events, student mastery, subject summary, and teacher class summary.
-- Apply only to approved non-production environments after review.

create table public.learning_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  assignment_id uuid not null references public.assignments(id) on delete restrict,
  submission_id uuid not null references public.assignment_submissions(id) on delete restrict,
  student_id uuid not null references public.profiles(id) on delete restrict,
  class_id uuid not null references public.classes(id) on delete restrict,
  curriculum_id uuid not null references public.curriculums(id) on delete restrict,
  curriculum_version_id uuid not null references public.curriculum_versions(id) on delete restrict,
  question_id text not null check (
    question_id = btrim(question_id) and char_length(question_id) between 1 and 160
  ),
  knowledge_point_id text not null check (
    knowledge_point_id = btrim(knowledge_point_id)
    and char_length(knowledge_point_id) between 1 and 160
  ),
  learning_objective_id text check (
    learning_objective_id is null
    or (
      learning_objective_id = btrim(learning_objective_id)
      and char_length(learning_objective_id) between 1 and 160
    )
  ),
  subject text not null check (
    subject = btrim(subject) and char_length(subject) between 1 and 80
  ),
  grade text not null check (
    grade = btrim(grade) and char_length(grade) between 1 and 80
  ),
  difficulty smallint not null check (difficulty between 1 and 5),
  correct boolean not null,
  earned_score numeric(8, 3) not null check (earned_score >= 0),
  max_score numeric(8, 3) not null check (max_score > 0),
  time_spent_seconds integer not null check (time_spent_seconds >= 0),
  attempt_number integer not null check (attempt_number >= 1),
  answered_at timestamptz not null,
  created_at timestamptz not null default timezone('utc'::text, now()),
  constraint learning_events_score_bounds check (earned_score <= max_score),
  constraint learning_events_unique_attempt unique (
    organization_id,
    submission_id,
    question_id,
    knowledge_point_id,
    attempt_number
  )
);

comment on table public.learning_events is
  'AN-001 immutable per-answer learning events. Insert-only; history must not be overwritten.';

create table public.student_knowledge_mastery (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  student_id uuid not null references public.profiles(id) on delete restrict,
  knowledge_point_id text not null check (
    knowledge_point_id = btrim(knowledge_point_id)
    and char_length(knowledge_point_id) between 1 and 160
  ),
  subject text not null check (
    subject = btrim(subject) and char_length(subject) between 1 and 80
  ),
  grade text not null check (
    grade = btrim(grade) and char_length(grade) between 1 and 80
  ),
  correct_count integer not null default 0 check (correct_count >= 0),
  incorrect_count integer not null default 0 check (incorrect_count >= 0),
  attempt_count integer not null default 0 check (attempt_count >= 0),
  accuracy numeric(6, 4) not null default 0 check (accuracy between 0 and 1),
  last_answered_at timestamptz not null,
  mastery_score numeric(6, 4) not null default 0 check (mastery_score between 0 and 1),
  mastery_level text not null default 'unknown' check (
    mastery_level in ('unknown', 'beginner', 'developing', 'proficient', 'mastered')
  ),
  updated_at timestamptz not null default timezone('utc'::text, now()),
  constraint student_knowledge_mastery_unique unique (
    organization_id,
    student_id,
    knowledge_point_id
  ),
  constraint student_knowledge_mastery_attempt_total check (
    attempt_count = correct_count + incorrect_count
  )
);

comment on table public.student_knowledge_mastery is
  'AN-001 rebuildable per-student per-knowledge-point mastery projection.';

create table public.student_subject_summary (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  student_id uuid not null references public.profiles(id) on delete restrict,
  subject text not null check (
    subject = btrim(subject) and char_length(subject) between 1 and 80
  ),
  grade text not null check (
    grade = btrim(grade) and char_length(grade) between 1 and 80
  ),
  accuracy numeric(6, 4) not null default 0 check (accuracy between 0 and 1),
  average_score numeric(6, 4) not null default 0 check (average_score between 0 and 1),
  question_count integer not null default 0 check (question_count >= 0),
  knowledge_count integer not null default 0 check (knowledge_count >= 0),
  mastery_distribution jsonb not null default '{}'::jsonb check (
    jsonb_typeof(mastery_distribution) = 'object'
  ),
  last_activity timestamptz not null,
  updated_at timestamptz not null default timezone('utc'::text, now()),
  constraint student_subject_summary_unique unique (
    organization_id,
    student_id,
    subject,
    grade
  )
);

comment on table public.student_subject_summary is
  'AN-001 rebuildable per-student subject summary projection.';

create table public.teacher_class_summary (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  class_id uuid not null references public.classes(id) on delete restrict,
  teacher_id uuid not null references public.profiles(id) on delete restrict,
  subject text not null check (
    subject = btrim(subject) and char_length(subject) between 1 and 80
  ),
  grade text not null check (
    grade = btrim(grade) and char_length(grade) between 1 and 80
  ),
  accuracy numeric(6, 4) not null default 0 check (accuracy between 0 and 1),
  question_count integer not null default 0 check (question_count >= 0),
  student_count integer not null default 0 check (student_count >= 0),
  knowledge_distribution jsonb not null default '{}'::jsonb check (
    jsonb_typeof(knowledge_distribution) = 'object'
  ),
  weak_knowledge_ranking jsonb not null default '[]'::jsonb check (
    jsonb_typeof(weak_knowledge_ranking) = 'array'
  ),
  activity_trend jsonb not null default '[]'::jsonb check (
    jsonb_typeof(activity_trend) = 'array'
  ),
  last_activity timestamptz not null,
  updated_at timestamptz not null default timezone('utc'::text, now()),
  constraint teacher_class_summary_unique unique (
    organization_id,
    class_id,
    subject,
    grade
  )
);

comment on table public.teacher_class_summary is
  'AN-001 rebuildable class summary projection for teacher-facing APIs. No dashboard UI is created.';

create table public.learning_audit_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  student_id uuid references public.profiles(id) on delete restrict,
  actor_id uuid not null references auth.users(id) on delete restrict,
  action text not null check (
    action in ('LEARNING_EVENT_CREATED', 'LEARNING_SUMMARY_VIEWED')
  ),
  metadata jsonb not null default '{}'::jsonb check (
    jsonb_typeof(metadata) = 'object'
  ),
  created_at timestamptz not null default timezone('utc'::text, now())
);

comment on table public.learning_audit_events is
  'AN-001 learning analytics audit events. Does not store answers, worksheet content, or PII beyond scoped references.';

create index learning_events_student_timeline_idx
on public.learning_events (organization_id, student_id, answered_at desc);

create index learning_events_knowledge_idx
on public.learning_events (organization_id, student_id, knowledge_point_id, answered_at desc);

create index learning_events_class_idx
on public.learning_events (organization_id, class_id, answered_at desc);

create index student_knowledge_mastery_student_idx
on public.student_knowledge_mastery (organization_id, student_id, mastery_score, last_answered_at desc);

create index student_subject_summary_student_idx
on public.student_subject_summary (organization_id, student_id, last_activity desc);

create index teacher_class_summary_teacher_idx
on public.teacher_class_summary (organization_id, teacher_id, last_activity desc);

create index learning_audit_events_scope_idx
on public.learning_audit_events (organization_id, student_id, created_at desc);

create trigger student_knowledge_mastery_set_updated_at
before update on public.student_knowledge_mastery
for each row
execute function public.set_updated_at();

create trigger student_subject_summary_set_updated_at
before update on public.student_subject_summary
for each row
execute function public.set_updated_at();

create trigger teacher_class_summary_set_updated_at
before update on public.teacher_class_summary
for each row
execute function public.set_updated_at();

create or replace function public.validate_learning_event()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1
    from public.assignments as assignment
    where assignment.id = new.assignment_id
      and assignment.organization_id = new.organization_id
      and assignment.curriculum_id = new.curriculum_id
      and assignment.curriculum_version_id = new.curriculum_version_id
  ) then
    raise exception using errcode = '22023', message = 'learning_event_invalid_assignment';
  end if;

  if not exists (
    select 1
    from public.assignment_students as assignment_student
    where assignment_student.assignment_id = new.assignment_id
      and assignment_student.organization_id = new.organization_id
      and assignment_student.student_id = new.student_id
  ) then
    raise exception using errcode = '22023', message = 'learning_event_invalid_student_assignment';
  end if;

  if not exists (
    select 1
    from public.assignment_submissions as submission
    where submission.id = new.submission_id
      and submission.assignment_id = new.assignment_id
      and submission.organization_id = new.organization_id
      and submission.student_id = new.student_id
  ) then
    raise exception using errcode = '22023', message = 'learning_event_invalid_submission';
  end if;

  if not exists (
    select 1
    from public.class_enrollments as enrollment
    where enrollment.class_id = new.class_id
      and enrollment.organization_id = new.organization_id
      and enrollment.student_id = new.student_id
      and enrollment.status = 'active'
  ) then
    raise exception using errcode = '22023', message = 'learning_event_invalid_student_assignment';
  end if;

  return new;
end;
$$;

create or replace function public.prevent_learning_event_mutation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  raise exception using errcode = '42501', message = 'learning_event_immutable';
end;
$$;

revoke all on function public.validate_learning_event() from public;
revoke all on function public.prevent_learning_event_mutation() from public;

create trigger learning_events_validate
before insert on public.learning_events
for each row
execute function public.validate_learning_event();

create trigger learning_events_prevent_update
before update on public.learning_events
for each row
execute function public.prevent_learning_event_mutation();

create trigger learning_events_prevent_delete
before delete on public.learning_events
for each row
execute function public.prevent_learning_event_mutation();

alter table public.learning_events enable row level security;
alter table public.learning_events force row level security;
alter table public.student_knowledge_mastery enable row level security;
alter table public.student_knowledge_mastery force row level security;
alter table public.student_subject_summary enable row level security;
alter table public.student_subject_summary force row level security;
alter table public.teacher_class_summary enable row level security;
alter table public.teacher_class_summary force row level security;
alter table public.learning_audit_events enable row level security;
alter table public.learning_audit_events force row level security;

revoke all on table public.learning_events from anon, authenticated;
revoke all on table public.student_knowledge_mastery from anon, authenticated;
revoke all on table public.student_subject_summary from anon, authenticated;
revoke all on table public.teacher_class_summary from anon, authenticated;
revoke all on table public.learning_audit_events from anon, authenticated;

grant select, insert on table public.learning_events to authenticated;
grant select, insert, update on table public.student_knowledge_mastery to authenticated;
grant select, insert, update on table public.student_subject_summary to authenticated;
grant select, insert, update on table public.teacher_class_summary to authenticated;
grant select, insert on table public.learning_audit_events to authenticated;

create policy "learning_events_select_scoped"
on public.learning_events
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
    where classroom.id = learning_events.class_id
      and classroom.teacher_id = (select auth.uid())
  )
);

create policy "learning_events_insert_student"
on public.learning_events
for insert
to authenticated
with check (
  public.has_organization_role(
    organization_id,
    array['organization_owner', 'organization_admin']::text[]
  )
  or student_id = (select auth.uid())
);

create policy "student_knowledge_mastery_select_scoped"
on public.student_knowledge_mastery
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
    from public.class_enrollments as enrollment
    join public.classes as classroom
      on classroom.id = enrollment.class_id
    where enrollment.organization_id = student_knowledge_mastery.organization_id
      and enrollment.student_id = student_knowledge_mastery.student_id
      and enrollment.status = 'active'
      and classroom.teacher_id = (select auth.uid())
  )
);

create policy "student_knowledge_mastery_write_scoped"
on public.student_knowledge_mastery
for all
to authenticated
using (
  public.is_active_organization_member(organization_id)
  and (
    public.has_organization_role(
      organization_id,
      array['organization_owner', 'organization_admin']::text[]
    )
    or student_id = (select auth.uid())
  )
)
with check (
  public.is_active_organization_member(organization_id)
  and (
    public.has_organization_role(
      organization_id,
      array['organization_owner', 'organization_admin']::text[]
    )
    or student_id = (select auth.uid())
  )
);

create policy "student_subject_summary_select_scoped"
on public.student_subject_summary
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
    from public.class_enrollments as enrollment
    join public.classes as classroom
      on classroom.id = enrollment.class_id
    where enrollment.organization_id = student_subject_summary.organization_id
      and enrollment.student_id = student_subject_summary.student_id
      and enrollment.status = 'active'
      and classroom.teacher_id = (select auth.uid())
  )
);

create policy "student_subject_summary_write_scoped"
on public.student_subject_summary
for all
to authenticated
using (
  public.is_active_organization_member(organization_id)
  and (
    public.has_organization_role(
      organization_id,
      array['organization_owner', 'organization_admin']::text[]
    )
    or student_id = (select auth.uid())
  )
)
with check (
  public.is_active_organization_member(organization_id)
  and (
    public.has_organization_role(
      organization_id,
      array['organization_owner', 'organization_admin']::text[]
    )
    or student_id = (select auth.uid())
  )
);

create policy "teacher_class_summary_select_scoped"
on public.teacher_class_summary
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
    where enrollment.organization_id = teacher_class_summary.organization_id
      and enrollment.class_id = teacher_class_summary.class_id
      and enrollment.student_id = (select auth.uid())
      and enrollment.status = 'active'
  )
);

create policy "teacher_class_summary_write_scoped"
on public.teacher_class_summary
for all
to authenticated
using (
  public.is_active_organization_member(organization_id)
)
with check (
  public.is_active_organization_member(organization_id)
);

create policy "learning_audit_select_admin"
on public.learning_audit_events
for select
to authenticated
using (
  public.has_organization_role(
    organization_id,
    array['organization_owner', 'organization_admin']::text[]
  )
);

create policy "learning_audit_insert_scoped"
on public.learning_audit_events
for insert
to authenticated
with check (
  public.is_active_organization_member(organization_id)
  and actor_id = (select auth.uid())
);
