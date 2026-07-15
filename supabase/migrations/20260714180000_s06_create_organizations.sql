-- Sprint 6: Establish organization multi-tenancy, memberships, and active context.
-- This migration is additive. Apply only to an approved development, local, or
-- staging project after reviewing the SECURITY DEFINER functions and RLS.

create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null check (
    name = btrim(name) and char_length(name) between 2 and 120
  ),
  slug text not null unique check (
    slug = lower(slug)
    and char_length(slug) between 3 and 48
    and slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'
    and slug not in (
      'admin',
      'api',
      'auth',
      'dashboard',
      'settings',
      'system',
      'support'
    )
  ),
  business_name text check (
    business_name is null or (
      business_name = btrim(business_name)
      and char_length(business_name) between 2 and 160
    )
  ),
  tax_id text check (
    tax_id is null or (
      tax_id = btrim(tax_id)
      and
      char_length(tax_id) between 2 and 20
      and tax_id ~ '^[A-Za-z0-9-]+$'
    )
  ),
  phone text check (
    phone is null or (
      phone = btrim(phone)
      and
      char_length(phone) between 6 and 30
      and phone ~ '^[0-9+() -]+$'
    )
  ),
  email text check (
    email is null or (
      email = lower(btrim(email))
      and
      char_length(email) between 3 and 254
      and email ~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
    )
  ),
  address text check (
    address is null or (
      address = btrim(address)
      and char_length(address) between 2 and 300
    )
  ),
  logo_path text check (
    logo_path is null or char_length(logo_path) <= 2048
  ),
  status text not null default 'active' check (
    status in ('active', 'suspended', 'archived')
  ),
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now()),
  deleted_at timestamptz,
  constraint organizations_deleted_only_when_archived check (
    deleted_at is null or status = 'archived'
  )
);

comment on table public.organizations is
  'Tenant boundary for tutoring schools and education organizations.';
comment on column public.organizations.logo_path is
  'Reserved private organization logo path. Upload is not implemented in Sprint 6.';

create table public.organization_members (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (
    role in (
      'organization_owner',
      'organization_admin',
      'teacher',
      'reviewer',
      'branch_manager',
      'student',
      'guardian'
    )
  ),
  status text not null check (
    status in ('active', 'invited', 'suspended', 'removed')
  ),
  joined_at timestamptz,
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now()),
  constraint organization_members_unique_user unique (organization_id, user_id),
  constraint organization_members_active_joined check (
    status <> 'active' or joined_at is not null
  )
);

comment on table public.organization_members is
  'Organization membership and role boundary. Direct writes are denied in Sprint 6.';

create table public.user_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  active_organization_id uuid references public.organizations(id) on delete set null,
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now())
);

comment on table public.user_preferences is
  'User-owned application context, separate from identity profile data.';

create index organizations_created_by_idx
on public.organizations (created_by);

create index organizations_active_idx
on public.organizations (status, created_at)
where deleted_at is null;

create index organization_members_user_active_idx
on public.organization_members (user_id, organization_id)
where status = 'active';

create index organization_members_organization_active_idx
on public.organization_members (organization_id, role, user_id)
where status = 'active';

create index user_preferences_active_organization_idx
on public.user_preferences (active_organization_id)
where active_organization_id is not null;

create trigger organizations_set_updated_at
before update on public.organizations
for each row
execute function public.set_updated_at();

create trigger organization_members_set_updated_at
before update on public.organization_members
for each row
execute function public.set_updated_at();

create trigger user_preferences_set_updated_at
before update on public.user_preferences
for each row
execute function public.set_updated_at();

alter table public.organizations enable row level security;
alter table public.organizations force row level security;
alter table public.organization_members enable row level security;
alter table public.organization_members force row level security;
alter table public.user_preferences enable row level security;
alter table public.user_preferences force row level security;

revoke all on table public.organizations from anon, authenticated;
revoke all on table public.organization_members from anon, authenticated;
revoke all on table public.user_preferences from anon, authenticated;

grant select on table public.organizations to authenticated;
grant update (
  name,
  business_name,
  tax_id,
  phone,
  email,
  address
) on table public.organizations to authenticated;
grant select on table public.organization_members to authenticated;
grant select on table public.user_preferences to authenticated;

create or replace function public.is_active_organization_member(
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
    from public.organization_members as membership
    join public.organizations as organization
      on organization.id = membership.organization_id
    where membership.organization_id = p_organization_id
      and membership.user_id = (select auth.uid())
      and membership.status = 'active'
      and organization.status = 'active'
      and organization.deleted_at is null
  );
$$;

create or replace function public.has_organization_role(
  p_organization_id uuid,
  p_roles text[]
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.organization_members as membership
    join public.organizations as organization
      on organization.id = membership.organization_id
    where membership.organization_id = p_organization_id
      and membership.user_id = (select auth.uid())
      and membership.status = 'active'
      and membership.role = any (p_roles)
      and organization.status = 'active'
      and organization.deleted_at is null
  );
$$;

create or replace function public.get_active_organization_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (
      select preference.active_organization_id
      from public.user_preferences as preference
      join public.organization_members as membership
        on membership.organization_id = preference.active_organization_id
       and membership.user_id = preference.user_id
      join public.organizations as organization
        on organization.id = preference.active_organization_id
      where preference.user_id = (select auth.uid())
        and membership.status = 'active'
        and organization.status = 'active'
        and organization.deleted_at is null
      limit 1
    ),
    (
      select membership.organization_id
      from public.organization_members as membership
      join public.organizations as organization
        on organization.id = membership.organization_id
      where membership.user_id = (select auth.uid())
        and membership.status = 'active'
        and organization.status = 'active'
        and organization.deleted_at is null
      order by membership.joined_at asc, membership.created_at asc
      limit 1
    )
  );
$$;

revoke all on function public.is_active_organization_member(uuid) from public, anon;
revoke all on function public.has_organization_role(uuid, text[]) from public, anon;
revoke all on function public.get_active_organization_id() from public, anon;
grant execute on function public.is_active_organization_member(uuid) to authenticated;
grant execute on function public.has_organization_role(uuid, text[]) to authenticated;
grant execute on function public.get_active_organization_id() to authenticated;

create policy "organizations_select_member"
on public.organizations
for select
to authenticated
using (
  deleted_at is null
  and status = 'active'
  and public.is_active_organization_member(id)
);

create policy "organizations_update_admin"
on public.organizations
for update
to authenticated
using (
  deleted_at is null
  and status = 'active'
  and public.has_organization_role(
    id,
    array['organization_owner', 'organization_admin']::text[]
  )
)
with check (
  deleted_at is null
  and status = 'active'
  and public.has_organization_role(
    id,
    array['organization_owner', 'organization_admin']::text[]
  )
);

create policy "organization_members_select_member"
on public.organization_members
for select
to authenticated
using (public.is_active_organization_member(organization_id));

create policy "user_preferences_select_own"
on public.user_preferences
for select
to authenticated
using (user_id = (select auth.uid()));

create or replace function public.prevent_last_organization_owner()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_invalidates_owner boolean := false;
begin
  if tg_op = 'DELETE' then
    v_invalidates_owner := true;
  else
    v_invalidates_owner := (
      new.role <> 'organization_owner' or new.status <> 'active'
    );
  end if;

  if old.role = 'organization_owner'
    and old.status = 'active'
    and v_invalidates_owner
    and not exists (
      select 1
      from public.organization_members as other_owner
      where other_owner.organization_id = old.organization_id
        and other_owner.id <> old.id
        and other_owner.role = 'organization_owner'
        and other_owner.status = 'active'
    )
  then
    raise exception using
      errcode = '23514',
      message = 'organization_requires_active_owner';
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

create trigger organization_members_preserve_last_owner
before update of role, status or delete on public.organization_members
for each row
execute function public.prevent_last_organization_owner();

create or replace function public.ensure_organization_has_owner()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1
    from public.organization_members as owner_membership
    where owner_membership.organization_id = new.id
      and owner_membership.role = 'organization_owner'
      and owner_membership.status = 'active'
  ) then
    raise exception using
      errcode = '23514',
      message = 'organization_requires_active_owner';
  end if;
  return new;
end;
$$;

create constraint trigger organizations_require_owner
after insert on public.organizations
deferrable initially deferred
for each row
execute function public.ensure_organization_has_owner();

create or replace function public.clear_invalid_active_membership_preference()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    update public.user_preferences
    set active_organization_id = null
    where user_id = old.user_id
      and active_organization_id = old.organization_id;
    return old;
  end if;

  if new.status <> 'active'
    or new.organization_id <> old.organization_id
    or new.user_id <> old.user_id
  then
    update public.user_preferences
    set active_organization_id = null
    where user_id = old.user_id
      and active_organization_id = old.organization_id;
  end if;

  return new;
end;
$$;

create trigger organization_members_clear_invalid_preference
after update of status, organization_id, user_id or delete
on public.organization_members
for each row
execute function public.clear_invalid_active_membership_preference();

create or replace function public.clear_invalid_organization_preferences()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status <> 'active' or new.deleted_at is not null then
    update public.user_preferences
    set active_organization_id = null
    where active_organization_id = new.id;
  end if;
  return new;
end;
$$;

create trigger organizations_clear_invalid_preferences
after update of status, deleted_at on public.organizations
for each row
execute function public.clear_invalid_organization_preferences();

revoke all on function public.prevent_last_organization_owner() from public;
revoke all on function public.ensure_organization_has_owner() from public;
revoke all on function public.clear_invalid_active_membership_preference() from public;
revoke all on function public.clear_invalid_organization_preferences() from public;

create or replace function public.create_organization_with_owner(
  p_name text,
  p_slug text,
  p_business_name text default null,
  p_phone text default null,
  p_email text default null,
  p_address text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_organization_id uuid;
begin
  if v_user_id is null then
    raise exception using errcode = '42501', message = 'authentication_required';
  end if;

  if not exists (
    select 1
    from public.profiles as profile
    where profile.id = v_user_id
      and profile.onboarding_completed = true
  ) then
    raise exception using errcode = '42501', message = 'profile_not_completed';
  end if;

  if p_name is null
    or p_name <> btrim(p_name)
    or char_length(p_name) not between 2 and 120
  then
    raise exception using errcode = '22023', message = 'invalid_organization_name';
  end if;

  if p_slug is null
    or p_slug <> lower(btrim(p_slug))
    or char_length(p_slug) not between 3 and 48
    or p_slug !~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'
    or p_slug in (
      'admin',
      'api',
      'auth',
      'dashboard',
      'settings',
      'system',
      'support'
    )
  then
    raise exception using errcode = '22023', message = 'invalid_organization_slug';
  end if;

  if (
    nullif(btrim(p_business_name), '') is not null
    and char_length(btrim(p_business_name)) not between 2 and 160
  ) or (
    nullif(btrim(p_phone), '') is not null
    and (
      char_length(btrim(p_phone)) not between 6 and 30
      or btrim(p_phone) !~ '^[0-9+() -]+$'
    )
  ) or (
    nullif(btrim(p_email), '') is not null
    and (
      char_length(btrim(p_email)) not between 3 and 254
      or btrim(p_email) !~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
    )
  ) or (
    nullif(btrim(p_address), '') is not null
    and char_length(btrim(p_address)) not between 2 and 300
  )
  then
    raise exception using errcode = '22023', message = 'invalid_organization_details';
  end if;

  insert into public.organizations (
    name,
    slug,
    business_name,
    phone,
    email,
    address,
    status,
    created_by
  ) values (
    p_name,
    p_slug,
    nullif(btrim(p_business_name), ''),
    nullif(btrim(p_phone), ''),
    nullif(lower(btrim(p_email)), ''),
    nullif(btrim(p_address), ''),
    'active',
    v_user_id
  )
  returning id into v_organization_id;

  insert into public.organization_members (
    organization_id,
    user_id,
    role,
    status,
    joined_at
  ) values (
    v_organization_id,
    v_user_id,
    'organization_owner',
    'active',
    timezone('utc'::text, now())
  );

  insert into public.user_preferences (user_id, active_organization_id)
  values (v_user_id, v_organization_id)
  on conflict (user_id) do update
  set active_organization_id = excluded.active_organization_id;

  return v_organization_id;
exception
  when unique_violation then
    raise exception using errcode = '23505', message = 'organization_slug_taken';
end;
$$;

create or replace function public.switch_active_organization(
  p_organization_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then
    raise exception using errcode = '42501', message = 'authentication_required';
  end if;

  if not exists (
    select 1
    from public.organization_members as membership
    join public.organizations as organization
      on organization.id = membership.organization_id
    where membership.organization_id = p_organization_id
      and membership.user_id = v_user_id
      and membership.status = 'active'
      and organization.status = 'active'
      and organization.deleted_at is null
  ) then
    raise exception using errcode = '42501', message = 'invalid_organization_membership';
  end if;

  insert into public.user_preferences (user_id, active_organization_id)
  values (v_user_id, p_organization_id)
  on conflict (user_id) do update
  set active_organization_id = excluded.active_organization_id;

  return p_organization_id;
end;
$$;

revoke all on function public.create_organization_with_owner(
  text,
  text,
  text,
  text,
  text,
  text
) from public, anon;
revoke all on function public.switch_active_organization(uuid) from public, anon;
grant execute on function public.create_organization_with_owner(
  text,
  text,
  text,
  text,
  text,
  text
) to authenticated;
grant execute on function public.switch_active_organization(uuid) to authenticated;

-- No direct INSERT or DELETE policy is provided for organizations. No direct
-- INSERT, UPDATE, or DELETE policy is provided for memberships or preferences.
-- Sprint 8 invitations and Sprint 9 RBAC must extend these boundaries through
-- separately reviewed RPCs instead of weakening the Sprint 6 policies.
