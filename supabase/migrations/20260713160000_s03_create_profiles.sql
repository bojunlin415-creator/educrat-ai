-- Sprint 3: Create the user-owned profiles table and shared updated_at trigger.
-- Apply only to an approved local or staging Supabase project after review.

create or replace function public.set_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.updated_at = timezone('utc'::text, now());
  return new;
end;
$$;

revoke all on function public.set_updated_at() from public;

create or replace function public.database_health()
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$
  select true;
$$;

revoke all on function public.database_health() from public;
grant execute on function public.database_health() to anon, authenticated;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text check (
    display_name is null or char_length(display_name) between 1 and 80
  ),
  avatar_url text check (
    avatar_url is null or char_length(avatar_url) <= 2048
  ),
  phone text check (
    phone is null or char_length(phone) between 6 and 30
  ),
  locale text not null default 'zh-TW' check (
    locale ~ '^[a-z]{2,3}(-[A-Z]{2})?$'
  ),
  timezone text not null default 'Asia/Taipei' check (
    char_length(timezone) between 1 and 100
  ),
  onboarding_completed boolean not null default false,
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now())
);

comment on table public.profiles is
  'User-owned profile metadata. Authentication credentials remain in auth.users.';

create trigger profiles_set_updated_at
before update on public.profiles
for each row
execute function public.set_updated_at();

alter table public.profiles enable row level security;
alter table public.profiles force row level security;

revoke all on table public.profiles from anon, authenticated;
grant select on table public.profiles to authenticated;
grant insert (
  id,
  display_name,
  avatar_url,
  phone,
  locale,
  timezone,
  onboarding_completed
) on table public.profiles to authenticated;
grant update (
  display_name,
  avatar_url,
  phone,
  locale,
  timezone,
  onboarding_completed
) on table public.profiles to authenticated;

create policy "profiles_select_own"
on public.profiles
for select
to authenticated
using ((select auth.uid()) = id);

create policy "profiles_insert_own"
on public.profiles
for insert
to authenticated
with check ((select auth.uid()) = id);

create policy "profiles_update_own"
on public.profiles
for update
to authenticated
using ((select auth.uid()) = id)
with check ((select auth.uid()) = id);

-- No DELETE grant or policy is provided. Account deletion will be implemented
-- as a separate, audited server-side workflow in a later Sprint.
