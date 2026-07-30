-- AI-002 Adaptive Learning Engine
-- Forward-only recommendation, learning path, and recommendation audit foundation.
-- Apply only to approved non-production environments after review.

create table public.learning_recommendations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  student_id uuid not null references public.profiles(id) on delete restrict,
  subject text not null check (
    subject = btrim(subject) and char_length(subject) between 1 and 80
  ),
  grade text not null check (
    grade = btrim(grade) and char_length(grade) between 1 and 80
  ),
  knowledge_point_id text not null check (
    knowledge_point_id = btrim(knowledge_point_id)
    and char_length(knowledge_point_id) between 1 and 160
  ),
  recommended_difficulty text not null check (
    recommended_difficulty in ('easy', 'normal', 'hard')
  ),
  recommended_question_count integer not null check (
    recommended_question_count between 1 and 50
  ),
  recommended_curriculum_type text not null check (
    recommended_curriculum_type in ('remedial', 'advanced')
  ),
  reason text not null check (
    reason = btrim(reason) and char_length(reason) between 1 and 1000
  ),
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now()),
  constraint learning_recommendations_unique unique (
    organization_id,
    student_id,
    knowledge_point_id,
    subject,
    grade
  )
);

comment on table public.learning_recommendations is
  'AI-002 adaptive learning recommendations. Does not generate curriculum or call AI providers.';

create table public.learning_paths (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  student_id uuid not null references public.profiles(id) on delete restrict,
  subject text not null check (
    subject = btrim(subject) and char_length(subject) between 1 and 80
  ),
  grade text not null check (
    grade = btrim(grade) and char_length(grade) between 1 and 80
  ),
  current_knowledge_point_id text not null check (
    current_knowledge_point_id = btrim(current_knowledge_point_id)
    and char_length(current_knowledge_point_id) between 1 and 160
  ),
  next_step text not null check (
    next_step = btrim(next_step) and char_length(next_step) between 1 and 1000
  ),
  recommended_ability text not null check (
    recommended_ability = btrim(recommended_ability)
    and char_length(recommended_ability) between 1 and 1000
  ),
  recommended_curriculum text not null check (
    recommended_curriculum = btrim(recommended_curriculum)
    and char_length(recommended_curriculum) between 1 and 1000
  ),
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now()),
  constraint learning_paths_unique unique (
    organization_id,
    student_id,
    current_knowledge_point_id,
    subject,
    grade
  )
);

comment on table public.learning_paths is
  'AI-002 learning path recommendations. No dashboard, scheduler, or notification is created.';

create table public.learning_recommendation_audit_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  student_id uuid not null references public.profiles(id) on delete restrict,
  actor_id uuid not null references auth.users(id) on delete restrict,
  action text not null check (
    action in ('LEARNING_RECOMMENDATION_CREATED', 'LEARNING_PATH_VIEWED')
  ),
  metadata jsonb not null default '{}'::jsonb check (
    jsonb_typeof(metadata) = 'object'
  ),
  created_at timestamptz not null default timezone('utc'::text, now())
);

comment on table public.learning_recommendation_audit_events is
  'AI-002 recommendation audit events. Does not store worksheets, model payloads, AI responses, or answers.';

create index learning_recommendations_student_idx
on public.learning_recommendations (
  organization_id,
  student_id,
  subject,
  updated_at desc
);

create index learning_recommendations_knowledge_idx
on public.learning_recommendations (
  organization_id,
  knowledge_point_id,
  updated_at desc
);

create index learning_paths_student_idx
on public.learning_paths (organization_id, student_id, subject, updated_at desc);

create index learning_recommendation_audit_scope_idx
on public.learning_recommendation_audit_events (
  organization_id,
  student_id,
  created_at desc
);

create trigger learning_recommendations_set_updated_at
before update on public.learning_recommendations
for each row
execute function public.set_updated_at();

create trigger learning_paths_set_updated_at
before update on public.learning_paths
for each row
execute function public.set_updated_at();

create or replace function public.validate_learning_recommendation_student()
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
      and membership.user_id = new.student_id
      and membership.role = 'student'
      and membership.status = 'active'
      and organization.status = 'active'
      and organization.deleted_at is null
  ) then
    raise exception using errcode = '22023', message = 'adaptive_learning_invalid_student';
  end if;

  if not exists (
    select 1
    from public.student_knowledge_mastery as mastery
    where mastery.organization_id = new.organization_id
      and mastery.student_id = new.student_id
      and mastery.knowledge_point_id = new.knowledge_point_id
  ) then
    raise exception using errcode = '22023', message = 'adaptive_learning_analytics_required';
  end if;

  return new;
end;
$$;

create or replace function public.validate_learning_path_student()
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
      and membership.user_id = new.student_id
      and membership.role = 'student'
      and membership.status = 'active'
      and organization.status = 'active'
      and organization.deleted_at is null
  ) then
    raise exception using errcode = '22023', message = 'adaptive_learning_invalid_student';
  end if;

  if not exists (
    select 1
    from public.student_knowledge_mastery as mastery
    where mastery.organization_id = new.organization_id
      and mastery.student_id = new.student_id
      and mastery.knowledge_point_id = new.current_knowledge_point_id
  ) then
    raise exception using errcode = '22023', message = 'adaptive_learning_analytics_required';
  end if;

  return new;
end;
$$;

revoke all on function public.validate_learning_recommendation_student() from public;
revoke all on function public.validate_learning_path_student() from public;

create trigger learning_recommendations_validate_student
before insert or update of organization_id, student_id, knowledge_point_id
on public.learning_recommendations
for each row
execute function public.validate_learning_recommendation_student();

create trigger learning_paths_validate_student
before insert or update of organization_id, student_id, current_knowledge_point_id
on public.learning_paths
for each row
execute function public.validate_learning_path_student();

alter table public.learning_recommendations enable row level security;
alter table public.learning_recommendations force row level security;
alter table public.learning_paths enable row level security;
alter table public.learning_paths force row level security;
alter table public.learning_recommendation_audit_events enable row level security;
alter table public.learning_recommendation_audit_events force row level security;

revoke all on table public.learning_recommendations from anon, authenticated;
revoke all on table public.learning_paths from anon, authenticated;
revoke all on table public.learning_recommendation_audit_events from anon, authenticated;

grant select, insert, update on table public.learning_recommendations to authenticated;
grant select, insert, update on table public.learning_paths to authenticated;
grant select, insert on table public.learning_recommendation_audit_events to authenticated;

create policy "learning_recommendations_select_scoped"
on public.learning_recommendations
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
    where enrollment.organization_id = learning_recommendations.organization_id
      and enrollment.student_id = learning_recommendations.student_id
      and enrollment.status = 'active'
      and classroom.teacher_id = (select auth.uid())
  )
);

create policy "learning_recommendations_write_scoped"
on public.learning_recommendations
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
    or exists (
      select 1
      from public.class_enrollments as enrollment
      join public.classes as classroom
        on classroom.id = enrollment.class_id
      where enrollment.organization_id = learning_recommendations.organization_id
        and enrollment.student_id = learning_recommendations.student_id
        and enrollment.status = 'active'
        and classroom.teacher_id = (select auth.uid())
    )
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
    or exists (
      select 1
      from public.class_enrollments as enrollment
      join public.classes as classroom
        on classroom.id = enrollment.class_id
      where enrollment.organization_id = learning_recommendations.organization_id
        and enrollment.student_id = learning_recommendations.student_id
        and enrollment.status = 'active'
        and classroom.teacher_id = (select auth.uid())
    )
  )
);

create policy "learning_paths_select_scoped"
on public.learning_paths
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
    where enrollment.organization_id = learning_paths.organization_id
      and enrollment.student_id = learning_paths.student_id
      and enrollment.status = 'active'
      and classroom.teacher_id = (select auth.uid())
  )
);

create policy "learning_paths_write_scoped"
on public.learning_paths
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
    or exists (
      select 1
      from public.class_enrollments as enrollment
      join public.classes as classroom
        on classroom.id = enrollment.class_id
      where enrollment.organization_id = learning_paths.organization_id
        and enrollment.student_id = learning_paths.student_id
        and enrollment.status = 'active'
        and classroom.teacher_id = (select auth.uid())
    )
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
    or exists (
      select 1
      from public.class_enrollments as enrollment
      join public.classes as classroom
        on classroom.id = enrollment.class_id
      where enrollment.organization_id = learning_paths.organization_id
        and enrollment.student_id = learning_paths.student_id
        and enrollment.status = 'active'
        and classroom.teacher_id = (select auth.uid())
    )
  )
);

create policy "learning_recommendation_audit_select_admin"
on public.learning_recommendation_audit_events
for select
to authenticated
using (
  public.has_organization_role(
    organization_id,
    array['organization_owner', 'organization_admin']::text[]
  )
);

create policy "learning_recommendation_audit_insert_scoped"
on public.learning_recommendation_audit_events
for insert
to authenticated
with check (
  public.is_active_organization_member(organization_id)
  and actor_id = (select auth.uid())
);
