-- Sprint 8 architecture reserve for future subject and AI engines.
-- These are neutral curriculum attributes. This migration does not add
-- prompts, generation metadata, embeddings, or review workflow.

create function public.lesson_keywords_are_valid(p_keywords text[])
returns boolean
language sql
immutable
strict
set search_path = ''
as $$
  select
    cardinality(p_keywords) <= 30
    and not exists (
      select 1
      from unnest(p_keywords) as keyword(value)
      where keyword.value is null
        or keyword.value <> btrim(keyword.value)
        or char_length(keyword.value) not between 1 and 80
    )
    and cardinality(p_keywords) = (
      select count(distinct lower(keyword.value))
      from unnest(p_keywords) as keyword(value)
    );
$$;

revoke all on function public.lesson_keywords_are_valid(text[])
from public, anon, authenticated, service_role;

alter table public.lessons
add column difficulty smallint check (
  difficulty is null or difficulty between 1 and 5
),
add column keywords text[] not null default '{}'::text[] check (
  public.lesson_keywords_are_valid(keywords)
);

comment on column public.lessons.difficulty is
  'Optional grade-relative editorial difficulty from 1 to 5. Null means not classified; this is not an AI score.';
comment on column public.lessons.keywords is
  'Human-authored lesson keywords for search and future engine context; not prompt, embedding, or generation metadata.';
comment on function public.lesson_keywords_are_valid(text[]) is
  'Immutable constraint helper. Keywords are trimmed, non-empty, case-insensitively unique, at most 30 items and 80 characters each.';
