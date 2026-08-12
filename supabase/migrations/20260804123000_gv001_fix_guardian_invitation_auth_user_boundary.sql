-- GV-001: remove direct auth.users reads from guardian invitation RLS.
-- Forward-only security fix. Do not grant authenticated users direct access to
-- auth.users; expose only the current account's verified email through a
-- SECURITY DEFINER helper with a fixed search_path.

create or replace function public.get_current_verified_auth_email()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select lower(auth_user.email)
  from auth.users as auth_user
  where auth_user.id = (select auth.uid())
    and auth_user.email_confirmed_at is not null
  limit 1;
$$;

revoke all on function public.get_current_verified_auth_email()
from public, anon;
grant execute on function public.get_current_verified_auth_email()
to authenticated;

drop policy if exists "guardian_invitations_email_select"
on public.guardian_invitations;

create policy "guardian_invitations_email_select"
on public.guardian_invitations
for select
to authenticated
using (
  status = 'pending'
  and expires_at > timezone('utc'::text, now())
  and guardian_email_normalized = public.get_current_verified_auth_email()
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

  v_email := public.get_current_verified_auth_email();

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
  ) values (
    v_invitation.organization_id,
    v_invitation.student_id,
    v_account_id,
    v_account_id,
    v_invitation.relationship_type,
    'active',
    v_invitation.created_at,
    v_invitation.created_by,
    'organization_invitation',
    timezone('utc'::text, now()),
    v_invitation.created_by,
    timezone('utc'::text, now()),
    p_consent_version,
    timezone('utc'::text, now()),
    v_account_id
  )
  on conflict (organization_id, student_id, guardian_user_id)
  where status = 'active'
  do update
  set consent_granted_at = excluded.consent_granted_at,
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

  insert into public.parent_portal_audit_events (
    organization_id,
    actor_id,
    action,
    student_id,
    metadata
  ) values (
    v_invitation.organization_id,
    v_account_id,
    'GUARDIAN_INVITATION_ACCEPTED',
    v_invitation.student_id,
    jsonb_build_object(
      'invitationId', v_invitation.id,
      'relationshipId', v_relationship_id,
      'consentVersion', p_consent_version
    )
  ), (
    v_invitation.organization_id,
    v_account_id,
    'GUARDIAN_CONSENT_GRANTED',
    v_invitation.student_id,
    jsonb_build_object(
      'relationshipId', v_relationship_id,
      'consentVersion', p_consent_version
    )
  ), (
    v_invitation.organization_id,
    v_account_id,
    'GUARDIAN_RELATIONSHIP_CREATED',
    v_invitation.student_id,
    jsonb_build_object('relationshipId', v_relationship_id)
  );

  return v_relationship_id;
end;
$$;

revoke all on function public.accept_guardian_invitation(text, text)
from public, anon;
grant execute on function public.accept_guardian_invitation(text, text)
to authenticated;
