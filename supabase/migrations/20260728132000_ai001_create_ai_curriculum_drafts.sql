-- AI-001: Real original curriculum generation.
-- Additive only. This does not modify historical migrations and does not
-- expose legacy publisher identity to AI context.

create table if not exists public.curriculum_ai_drafts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  curriculum_id uuid not null references public.curriculums(id) on delete restrict,
  curriculum_version_id uuid not null references public.curriculum_versions(id) on delete restrict,
  client_request_id uuid not null,
  title text not null check (
    title = btrim(title) and char_length(title) between 1 and 160
  ),
  content jsonb not null check (
    jsonb_typeof(content) = 'object'
    and content ? 'title'
    and content ? 'learningObjectives'
    and content ? 'summary'
    and content ? 'examples'
    and content ? 'questions'
    and content ? 'challengeQuestions'
    and content ? 'solutions'
    and content ? 'teacherNotes'
    and content ? 'knowledgePoints'
  ),
  edited boolean not null default false,
  generated_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now()),
  constraint curriculum_ai_drafts_unique_client_request unique (
    organization_id,
    client_request_id
  ),
  constraint curriculum_ai_drafts_unique_version unique (curriculum_version_id)
);

comment on table public.curriculum_ai_drafts is
  'AI-001 version-level original curriculum draft content. It stores structured output only; no publisher text, OCR, textbook mapping, prompt secrets, API keys, or provider raw response.';

create index if not exists curriculum_ai_drafts_curriculum_idx
on public.curriculum_ai_drafts (
  organization_id,
  curriculum_id,
  created_at desc
);

drop trigger if exists curriculum_ai_drafts_set_updated_at
on public.curriculum_ai_drafts;
create trigger curriculum_ai_drafts_set_updated_at
before update on public.curriculum_ai_drafts
for each row execute function public.set_updated_at();

alter table public.curriculum_ai_drafts enable row level security;
alter table public.curriculum_ai_drafts force row level security;

revoke all on table public.curriculum_ai_drafts from anon, authenticated;
grant select on table public.curriculum_ai_drafts to authenticated;

drop policy if exists "curriculum_ai_drafts_select_active_organization"
on public.curriculum_ai_drafts;
create policy "curriculum_ai_drafts_select_active_organization"
on public.curriculum_ai_drafts
for select
to authenticated
using (
  organization_id = public.get_active_organization_id()
  and public.is_active_organization_member(organization_id)
);

alter table public.curriculum_lifecycle_audit_events
drop constraint if exists curriculum_lifecycle_audit_events_action_check;

alter table public.curriculum_lifecycle_audit_events
add constraint curriculum_lifecycle_audit_events_action_check check (
  action in (
    'CURRICULUM_ARCHIVED',
    'CURRICULUM_RESTORED',
    'CURRICULUM_SOFT_DELETED',
    'CURRICULUM_PERMANENTLY_DELETED',
    'CURRICULUM_AI_GENERATED',
    'CURRICULUM_AI_EDITED',
    'CURRICULUM_AI_SAVED'
  )
);

drop policy if exists "curriculum_lifecycle_audit_insert_admin"
on public.curriculum_lifecycle_audit_events;
create policy "curriculum_lifecycle_audit_insert_admin"
on public.curriculum_lifecycle_audit_events
for insert
to authenticated
with check (
  (
    action in (
      'CURRICULUM_ARCHIVED',
      'CURRICULUM_RESTORED',
      'CURRICULUM_SOFT_DELETED',
      'CURRICULUM_PERMANENTLY_DELETED'
    )
    and public.has_organization_role(
      organization_id,
      array['organization_owner', 'organization_admin']::text[]
    )
  )
  or (
    action in (
      'CURRICULUM_AI_GENERATED',
      'CURRICULUM_AI_EDITED',
      'CURRICULUM_AI_SAVED'
    )
    and public.has_organization_role(
      organization_id,
      array['organization_owner', 'organization_admin', 'teacher']::text[]
    )
  )
);

create or replace function public.create_ai_generated_curriculum_draft(
  p_name text,
  p_subject_id uuid,
  p_grade_id uuid,
  p_publisher_id uuid,
  p_school_year integer,
  p_semester smallint,
  p_version_remark text,
  p_chapter_title text,
  p_chapter_description text,
  p_lesson_title text,
  p_learning_objectives text[],
  p_teaching_notes text,
  p_difficulty integer,
  p_keywords text[],
  p_client_request_id uuid,
  p_content jsonb,
  p_edited boolean
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_organization_id uuid;
  v_curriculum_id uuid;
  v_version_id uuid;
  v_chapter_id uuid;
  v_lesson_id uuid;
  v_draft_id uuid;
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
    array['organization_owner', 'organization_admin', 'teacher']::text[]
  ) then
    raise exception using errcode = '42501', message = 'curriculum_ai_write_forbidden';
  end if;

  if p_name is null
    or p_name <> btrim(p_name)
    or char_length(p_name) not between 2 and 120
    or p_school_year is null
    or p_school_year not between 100 and 999
    or p_semester is null
    or p_semester not in (1, 2)
    or (
      nullif(btrim(p_version_remark), '') is not null
      and char_length(btrim(p_version_remark)) > 1000
    )
    or p_chapter_title is null
    or p_chapter_title <> btrim(p_chapter_title)
    or char_length(p_chapter_title) not between 1 and 160
    or (
      nullif(btrim(p_chapter_description), '') is not null
      and char_length(btrim(p_chapter_description)) > 3000
    )
    or p_lesson_title is null
    or p_lesson_title <> btrim(p_lesson_title)
    or char_length(p_lesson_title) not between 1 and 160
    or p_learning_objectives is null
    or cardinality(p_learning_objectives) not between 1 and 30
    or exists (
      select 1
      from unnest(p_learning_objectives) as objective
      where objective <> btrim(objective)
        or char_length(objective) not between 1 and 300
    )
    or (
      nullif(btrim(p_teaching_notes), '') is not null
      and char_length(btrim(p_teaching_notes)) > 5000
    )
    or p_difficulty is null
    or p_difficulty not between 1 and 5
    or p_keywords is null
    or cardinality(p_keywords) > 30
    or p_client_request_id is null
    or exists (
      select 1
      from unnest(p_keywords) as keyword
      where keyword <> btrim(keyword)
        or char_length(keyword) not between 1 and 80
    )
    or p_content is null
    or jsonb_typeof(p_content) <> 'object'
    or not (
      p_content ? 'title'
      and p_content ? 'learningObjectives'
      and p_content ? 'summary'
      and p_content ? 'examples'
      and p_content ? 'questions'
      and p_content ? 'challengeQuestions'
      and p_content ? 'solutions'
      and p_content ? 'teacherNotes'
      and p_content ? 'knowledgePoints'
    )
  then
    raise exception using errcode = '22023', message = 'invalid_ai_curriculum_input';
  end if;

  select
    draft.curriculum_id,
    draft.curriculum_version_id,
    chapter.id,
    lesson.id,
    draft.id
  into
    v_curriculum_id,
    v_version_id,
    v_chapter_id,
    v_lesson_id,
    v_draft_id
  from public.curriculum_ai_drafts draft
  left join public.chapters chapter
    on chapter.curriculum_version_id = draft.curriculum_version_id
    and chapter.order_no = 1
  left join public.lessons lesson
    on lesson.chapter_id = chapter.id
    and lesson.order_no = 1
  where draft.organization_id = v_organization_id
    and draft.client_request_id = p_client_request_id
  limit 1;

  if v_draft_id is not null then
    return jsonb_build_object(
      'curriculumId', v_curriculum_id,
      'versionId', v_version_id,
      'chapterId', v_chapter_id,
      'lessonId', v_lesson_id,
      'draftId', v_draft_id,
      'idempotentReplay', true
    );
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
    'draft',
    v_user_id
  ) returning id into v_curriculum_id;

  insert into public.curriculum_versions (
    curriculum_id,
    version,
    status,
    remark
  ) values (
    v_curriculum_id,
    1,
    'draft',
    nullif(btrim(p_version_remark), '')
  ) returning id into v_version_id;

  insert into public.chapters (
    curriculum_version_id,
    chapter_no,
    title,
    description,
    order_no
  ) values (
    v_version_id,
    1,
    p_chapter_title,
    nullif(btrim(p_chapter_description), ''),
    1
  ) returning id into v_chapter_id;

  insert into public.lessons (
    chapter_id,
    lesson_no,
    title,
    learning_objectives,
    estimated_minutes,
    teaching_notes,
    status,
    order_no,
    difficulty,
    keywords
  ) values (
    v_chapter_id,
    1,
    p_lesson_title,
    p_learning_objectives,
    50,
    nullif(btrim(p_teaching_notes), ''),
    'draft',
    1,
    p_difficulty,
    p_keywords
  ) returning id into v_lesson_id;

  insert into public.curriculum_ai_drafts (
    organization_id,
    curriculum_id,
    curriculum_version_id,
    client_request_id,
    title,
    content,
    edited,
    generated_by
  ) values (
    v_organization_id,
    v_curriculum_id,
    v_version_id,
    p_client_request_id,
    p_name,
    p_content,
    coalesce(p_edited, false),
    v_user_id
  ) returning id into v_draft_id;

  return jsonb_build_object(
    'curriculumId', v_curriculum_id,
    'versionId', v_version_id,
    'chapterId', v_chapter_id,
    'lessonId', v_lesson_id,
    'draftId', v_draft_id
  );
exception
  when unique_violation then
    raise exception using errcode = '23505', message = 'curriculum_name_taken';
end;
$$;

revoke all on function public.create_ai_generated_curriculum_draft(
  text,
  uuid,
  uuid,
  uuid,
  integer,
  smallint,
  text,
  text,
  text,
  text,
  text[],
  text,
  integer,
  text[],
  uuid,
  jsonb,
  boolean
) from public, anon, service_role;

grant execute on function public.create_ai_generated_curriculum_draft(
  text,
  uuid,
  uuid,
  uuid,
  integer,
  smallint,
  text,
  text,
  text,
  text,
  text[],
  text,
  integer,
  text[],
  uuid,
  jsonb,
  boolean
) to authenticated;
