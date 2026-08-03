-- GV-001 Guardian Verification & Consent Foundation
-- Forward-only guardian invitation, verification, consent, and activation flow.
-- Apply only to approved non-production environments before product verification.

alter table public.student_guardians
add column if not exists guardian_account_id uuid references auth.users(id) on delete restrict,
add column if not exists requested_at timestamptz not null default timezone('utc'::text, now()),
add column if not exists requested_by uuid references auth.users(id) on delete restrict,
add column if not exists verification_method text,
add column if not exists verified_by uuid references auth.users(id) on delete restrict,
add column if not exists consent_granted_at timestamptz,
add column if not exists consent_version text,
add column if not exists activated_at timestamptz,
add column if not exists activated_by uuid references auth.users(id) on delete restrict,
add column if not exists revoked_at timestamptz,
add column if not exists revoked_by uuid references auth.users(id) on delete restrict,
add column if not exists revocation_reason text,
add column if not exists expires_at timestamptz;

update public.student_guardians
set guardian_account_id = guardian_user_id
where guardian_account_id is null;

alter table public.student_guardians
alter column guardian_account_id set not null;

alter table public.student_guardians
drop constraint if exists student_guardians_relationship_type_check,
drop constraint if exists student_guardians_status_check,
drop constraint if exists student_guardians_verified_active,
drop constraint if exists student_guardians_not_self;

alter table public.student_guardians
add constraint student_guardians_relationship_type_check check (
  relationship_type in (
    'parent',
    'legal_guardian',
    'authorized_caregiver',
    'other_verified_guardian'
  )
),
add constraint student_guardians_status_check check (
  status in ('pending', 'verified', 'active', 'revoked')
),
add constraint student_guardians_verified_state check (
  status not in ('verified', 'active')
  or (
    verification_method is not null
    and verified_at is not null
    and verified_by is not null
  )
),
add constraint student_guardians_active_state check (
  status <> 'active'
  or (
    consent_granted_at is not null
    and consent_version is not null
    and activated_at is not null
    and activated_by is not null
  )
),
add constraint student_guardians_revoked_state check (
  status <> 'revoked'
  or (
    revoked_at is not null
    and revoked_by is not null
    and revocation_reason is not null
  )
),
add constraint student_guardians_not_self check (
  student_id <> guardian_account_id
  and student_id <> guardian_user_id
),
add constraint student_guardians_consented_after_verified check (
  consent_granted_at is null
  or verified_at is null
  or consent_granted_at >= verified_at
),
add constraint student_guardians_activated_after_consent check (
  activated_at is null
  or consent_granted_at is null
  or activated_at >= consent_granted_at
),
add constraint student_guardians_consent_version_format check (
  consent_version is null
  or (
    consent_version = lower(btrim(consent_version))
    and char_length(consent_version) between 3 and 80
    and consent_version ~ '^[a-z0-9]+(?:[._-][a-z0-9]+)*$'
  )
);

create table public.guardian_invitations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  student_id uuid not null references public.profiles(id) on delete restrict,
  guardian_email_normalized text not null check (
    guardian_email_normalized = lower(btrim(guardian_email_normalized))
    and char_length(guardian_email_normalized) between 3 and 254
    and guardian_email_normalized ~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
  ),
  relationship_type text not null check (
    relationship_type in (
      'parent',
      'legal_guardian',
      'authorized_caregiver',
      'other_verified_guardian'
    )
  ),
  token_hash text not null unique check (token_hash ~ '^[a-f0-9]{64}$'),
  status text not null default 'pending' check (
    status in ('pending', 'accepted', 'expired', 'revoked')
  ),
  expires_at timestamptz not null,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default timezone('utc'::text, now()),
  accepted_at timestamptz,
  consumed_by_account_id uuid references auth.users(id) on delete restrict,
  consent_version text check (
    consent_version is null
    or (
      consent_version = lower(btrim(consent_version))
      and char_length(consent_version) between 3 and 80
      and consent_version ~ '^[a-z0-9]+(?:[._-][a-z0-9]+)*$'
    )
  ),
  updated_at timestamptz not null default timezone('utc'::text, now()),
  constraint guardian_invitations_expiration_after_create check (
    expires_at > created_at
  ),
  constraint guardian_invitations_accepted_state check (
    status <> 'accepted'
    or (
      accepted_at is not null
      and consumed_by_account_id is not null
      and consent_version is not null
    )
  )
);

comment on table public.guardian_invitations is
  'GV-001 organization-issued guardian invitations. Raw tokens are never stored; only token_hash is persisted.';

create index guardian_invitations_admin_idx
on public.guardian_invitations (organization_id, status, created_at desc);

create index guardian_invitations_email_idx
on public.guardian_invitations (guardian_email_normalized, status, expires_at);

create trigger guardian_invitations_set_updated_at
before update on public.guardian_invitations
for each row
execute function public.set_updated_at();

alter table public.parent_portal_audit_events
drop constraint if exists parent_portal_audit_events_action_check;

alter table public.parent_portal_audit_events
add constraint parent_portal_audit_events_action_check check (
  action in (
    'PARENT_DASHBOARD_VIEWED',
    'PARENT_STUDENT_REPORT_VIEWED',
    'GUARDIAN_INVITATION_CREATED',
    'GUARDIAN_INVITATION_ACCEPTED',
    'GUARDIAN_CONSENT_GRANTED',
    'GUARDIAN_RELATIONSHIP_CREATED',
    'GUARDIAN_RELATIONSHIP_REVOKED'
  )
);

create policy "parent_portal_audit_insert_admin_guardian_invitation"
on public.parent_portal_audit_events
for insert
to authenticated
with check (
  actor_id = (select auth.uid())
  and action = 'GUARDIAN_INVITATION_CREATED'
  and public.has_organization_role(
    organization_id,
    array['organization_owner', 'organization_admin']::text[]
  )
);

alter table public.guardian_invitations enable row level security;
alter table public.guardian_invitations force row level security;

revoke all on table public.guardian_invitations from anon, authenticated;
grant select, insert, update on table public.guardian_invitations to authenticated;

create policy "guardian_invitations_admin_select"
on public.guardian_invitations
for select
to authenticated
using (
  public.has_organization_role(
    organization_id,
    array['organization_owner', 'organization_admin']::text[]
  )
);

create policy "guardian_invitations_email_select"
on public.guardian_invitations
for select
to authenticated
using (
  status = 'pending'
  and expires_at > timezone('utc'::text, now())
  and guardian_email_normalized = (
    select lower(auth_user.email)
    from auth.users as auth_user
    where auth_user.id = (select auth.uid())
      and auth_user.email_confirmed_at is not null
  )
);

create policy "guardian_invitations_admin_insert"
on public.guardian_invitations
for insert
to authenticated
with check (
  created_by = (select auth.uid())
  and public.has_organization_role(
    organization_id,
    array['organization_owner', 'organization_admin']::text[]
  )
);

create policy "guardian_invitations_admin_update"
on public.guardian_invitations
for update
to authenticated
using (
  public.has_organization_role(
    organization_id,
    array['organization_owner', 'organization_admin']::text[]
  )
)
with check (
  public.has_organization_role(
    organization_id,
    array['organization_owner', 'organization_admin']::text[]
  )
);

create or replace function public.accept_guardian_invitation(
  p_token_hash text,
  p_consent_version text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_account_id uuid;
  v_email text;
  v_existing_membership public.organization_members%rowtype;
  v_invitation public.guardian_invitations%rowtype;
  v_relationship_id uuid;
begin
  v_account_id := (select auth.uid());

  if v_account_id is null then
    raise exception using errcode = '42501', message = 'authentication_required';
  end if;

  if p_token_hash is null or p_token_hash !~ '^[a-f0-9]{64}$' then
    raise exception using errcode = '22023', message = 'guardian_invalid_invitation';
  end if;

  if p_consent_version is null
    or p_consent_version <> lower(btrim(p_consent_version))
    or char_length(p_consent_version) not between 3 and 80
    or p_consent_version !~ '^[a-z0-9]+(?:[._-][a-z0-9]+)*$'
  then
    raise exception using errcode = '22023', message = 'guardian_invalid_consent';
  end if;

  select lower(auth_user.email)
  into v_email
  from auth.users as auth_user
  where auth_user.id = v_account_id
    and auth_user.email_confirmed_at is not null;

  if v_email is null then
    raise exception using errcode = '42501', message = 'guardian_verified_email_required';
  end if;

  select *
  into v_invitation
  from public.guardian_invitations as invitation
  where invitation.token_hash = p_token_hash
  for update;

  if v_invitation.id is null then
    raise exception using errcode = 'P0002', message = 'guardian_invitation_not_found';
  end if;

  if v_invitation.status <> 'pending'
    or v_invitation.expires_at <= timezone('utc'::text, now())
  then
    raise exception using errcode = '42501', message = 'guardian_invitation_not_available';
  end if;

  if v_invitation.guardian_email_normalized <> v_email then
    raise exception using errcode = '42501', message = 'guardian_email_mismatch';
  end if;

  if v_invitation.student_id = v_account_id then
    raise exception using errcode = '42501', message = 'guardian_self_relationship_forbidden';
  end if;

  select *
  into v_existing_membership
  from public.organization_members as membership
  where membership.organization_id = v_invitation.organization_id
    and membership.user_id = v_account_id
  for update;

  if v_existing_membership.id is null then
    insert into public.organization_members (
      organization_id,
      user_id,
      role,
      status,
      joined_at
    )
    values (
      v_invitation.organization_id,
      v_account_id,
      'guardian',
      'active',
      timezone('utc'::text, now())
    );
  elsif v_existing_membership.role = 'guardian' then
    update public.organization_members
    set status = 'active',
        joined_at = coalesce(joined_at, timezone('utc'::text, now()))
    where id = v_existing_membership.id;
  else
    raise exception using
      errcode = '42501',
      message = 'guardian_existing_membership_role_conflict';
  end if;

  insert into public.student_guardians (
    organization_id,
    student_id,
    guardian_user_id,
    guardian_account_id,
    relationship_type,
    status,
    requested_at,
    requested_by,
    verification_method,
    verified_at,
    verified_by,
    consent_granted_at,
    consent_version,
    activated_at,
    activated_by
  )
  values (
    v_invitation.organization_id,
    v_invitation.student_id,
    v_account_id,
    v_account_id,
    v_invitation.relationship_type,
    'active',
    v_invitation.created_at,
    v_invitation.created_by,
    'organization_issued_invitation',
    timezone('utc'::text, now()),
    v_invitation.created_by,
    timezone('utc'::text, now()),
    p_consent_version,
    timezone('utc'::text, now()),
    v_invitation.created_by
  )
  on conflict (organization_id, student_id, guardian_user_id)
  where status = 'active'
  do update set
    guardian_account_id = excluded.guardian_account_id,
    relationship_type = excluded.relationship_type,
    verification_method = excluded.verification_method,
    verified_at = excluded.verified_at,
    verified_by = excluded.verified_by,
    consent_granted_at = excluded.consent_granted_at,
    consent_version = excluded.consent_version,
    activated_at = excluded.activated_at,
    activated_by = excluded.activated_by
  returning id into v_relationship_id;

  update public.guardian_invitations
  set status = 'accepted',
      accepted_at = timezone('utc'::text, now()),
      consumed_by_account_id = v_account_id,
      consent_version = p_consent_version
  where id = v_invitation.id;

  insert into public.user_preferences (
    user_id,
    active_organization_id
  )
  values (
    v_account_id,
    v_invitation.organization_id
  )
  on conflict (user_id)
  do update set active_organization_id = excluded.active_organization_id;

  insert into public.parent_portal_audit_events (
    organization_id,
    actor_id,
    action,
    metadata
  )
  values
    (
      v_invitation.organization_id,
      v_account_id,
      'GUARDIAN_INVITATION_ACCEPTED',
      jsonb_build_object('invitationId', v_invitation.id, 'studentId', v_invitation.student_id)
    ),
    (
      v_invitation.organization_id,
      v_account_id,
      'GUARDIAN_CONSENT_GRANTED',
      jsonb_build_object('relationshipId', v_relationship_id, 'consentVersion', p_consent_version)
    ),
    (
      v_invitation.organization_id,
      v_account_id,
      'GUARDIAN_RELATIONSHIP_CREATED',
      jsonb_build_object('relationshipId', v_relationship_id, 'studentId', v_invitation.student_id)
    );

  return v_relationship_id;
end;
$$;

revoke all on function public.accept_guardian_invitation(text, text)
from public, anon, service_role;

grant execute on function public.accept_guardian_invitation(text, text)
to authenticated;

create or replace function public.revoke_guardian_relationship(
  p_relationship_id uuid,
  p_reason text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_account_id uuid;
  v_relationship public.student_guardians%rowtype;
begin
  v_account_id := (select auth.uid());

  if v_account_id is null then
    raise exception using errcode = '42501', message = 'authentication_required';
  end if;

  if p_relationship_id is null then
    raise exception using errcode = '22023', message = 'guardian_relationship_not_found';
  end if;

  if p_reason is null
    or char_length(btrim(p_reason)) < 3
    or char_length(btrim(p_reason)) > 240
  then
    raise exception using errcode = '22023', message = 'guardian_invalid_revocation_reason';
  end if;

  select *
  into v_relationship
  from public.student_guardians as relationship
  where relationship.id = p_relationship_id
  for update;

  if v_relationship.id is null then
    raise exception using errcode = 'P0002', message = 'guardian_relationship_not_found';
  end if;

  if not public.has_organization_role(
    v_relationship.organization_id,
    array['organization_owner', 'organization_admin']::text[]
  ) then
    raise exception using errcode = '42501', message = 'guardian_relationship_not_found';
  end if;

  if v_relationship.status <> 'active' then
    raise exception using errcode = '42501', message = 'guardian_relationship_not_active';
  end if;

  update public.student_guardians
  set status = 'revoked',
      revoked_at = timezone('utc'::text, now()),
      revoked_by = v_account_id,
      revocation_reason = btrim(p_reason)
  where id = v_relationship.id;

  insert into public.parent_portal_audit_events (
    organization_id,
    actor_id,
    action,
    metadata
  )
  values (
    v_relationship.organization_id,
    v_account_id,
    'GUARDIAN_RELATIONSHIP_REVOKED',
    jsonb_build_object(
      'relationshipId', v_relationship.id,
      'studentId', v_relationship.student_id
    )
  );

  return v_relationship.id;
end;
$$;

revoke all on function public.revoke_guardian_relationship(uuid, text)
from public, anon, service_role;

grant execute on function public.revoke_guardian_relationship(uuid, text)
to authenticated;
