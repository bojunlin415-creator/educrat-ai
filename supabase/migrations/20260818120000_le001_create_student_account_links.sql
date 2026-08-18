-- LE-001 Phase 1-2 learner parity and Student-to-Account link foundation.
-- Forward-only and additive. Apply only to the approved Development project.
-- This migration performs no historical backfill and changes no consumer authority.

create table public.student_account_links (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  student_id uuid not null,
  account_id uuid not null references auth.users(id) on delete restrict,
  status text not null check (status in ('pending', 'active', 'revoked', 'expired')),
  link_type text not null check (link_type in (
    'manual_verified',
    'account_claim',
    'migration_verified',
    'admin_verified'
  )),
  verified_at timestamptz,
  valid_from timestamptz not null default timezone('utc'::text, now()),
  valid_to timestamptz,
  created_at timestamptz not null default timezone('utc'::text, now()),
  created_by uuid not null references auth.users(id) on delete restrict,
  updated_at timestamptz not null default timezone('utc'::text, now()),
  correlation_id uuid not null default gen_random_uuid(),
  version text not null default 'le-001.v1' check (version = 'le-001.v1'),
  constraint student_account_links_student_tenant_fk
    foreign key (student_id, organization_id)
    references public.students(id, organization_id) on delete restrict,
  constraint student_account_links_valid_period check (
    valid_to is null or valid_to > valid_from
  ),
  constraint student_account_links_lifecycle_metadata check (
    (status = 'pending' and verified_at is null and valid_to is null)
    or (status = 'active' and verified_at is not null)
    or (status in ('revoked', 'expired') and verified_at is not null and valid_to is not null)
  )
);

comment on table public.student_account_links is
  'LE-001 verified, organization-scoped Account-to-canonical-Student identity links. No heuristic link is authoritative.';
comment on column public.student_account_links.account_id is
  'Auth Account identifier. ON DELETE RESTRICT preserves Student and link history until a future governed tombstone flow exists.';

create unique index student_account_links_active_student_unique
on public.student_account_links (organization_id, student_id)
where status = 'active';

create unique index student_account_links_active_account_unique
on public.student_account_links (organization_id, account_id)
where status = 'active';

create index student_account_links_account_status_idx
on public.student_account_links (account_id, organization_id, status, valid_from desc);

create index student_account_links_student_history_idx
on public.student_account_links (organization_id, student_id, created_at desc);

create table public.student_account_link_audit_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  link_id uuid not null references public.student_account_links(id) on delete restrict,
  student_id uuid not null,
  account_id uuid not null,
  actor_id uuid not null references auth.users(id) on delete restrict,
  action text not null check (action in (
    'STUDENT_ACCOUNT_LINK_CREATED',
    'STUDENT_ACCOUNT_LINK_REVOKED'
  )),
  correlation_id uuid not null,
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object'),
  created_at timestamptz not null default timezone('utc'::text, now()),
  constraint student_account_link_audit_student_tenant_fk
    foreign key (student_id, organization_id)
    references public.students(id, organization_id) on delete restrict
);

comment on table public.student_account_link_audit_events is
  'Append-only LE-001 account-link lifecycle audit. Stores identifiers and controlled codes only; never tokens, credentials, email, or Student PII.';

create index student_account_link_audit_scope_idx
on public.student_account_link_audit_events (
  organization_id,
  link_id,
  created_at desc
);

create trigger student_account_links_set_updated_at
before update on public.student_account_links
for each row execute function public.set_updated_at();

alter table public.student_account_links enable row level security;
alter table public.student_account_links force row level security;
alter table public.student_account_link_audit_events enable row level security;
alter table public.student_account_link_audit_events force row level security;

revoke all on table public.student_account_links from public, anon, authenticated;
revoke all on table public.student_account_link_audit_events from public, anon, authenticated;

grant select (
  id,
  organization_id,
  student_id,
  account_id,
  status,
  link_type,
  verified_at,
  valid_from,
  valid_to,
  version
) on table public.student_account_links to authenticated;

grant select on table public.student_account_link_audit_events to authenticated;

create policy "student_account_links_select_own_active"
on public.student_account_links
for select
to authenticated
using (
  account_id = (select auth.uid())
  and organization_id = public.get_active_organization_id()
  and public.is_active_organization_member(organization_id)
  and status = 'active'
  and valid_from <= now()
  and (valid_to is null or valid_to > now())
);

create policy "student_account_link_audit_select_admin"
on public.student_account_link_audit_events
for select
to authenticated
using (
  organization_id = public.get_active_organization_id()
  and public.has_organization_role(
    organization_id,
    array['organization_owner', 'organization_admin']::text[]
  )
);

create or replace function public.create_verified_student_account_link(
  p_student_id uuid,
  p_account_id uuid,
  p_link_type text,
  p_correlation_id uuid default gen_random_uuid()
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor_id uuid := auth.uid();
  v_link_id uuid;
  v_organization_id uuid := public.get_active_organization_id();
begin
  if v_actor_id is null then
    raise exception using errcode = '42501', message = 'authentication_required';
  end if;
  if v_organization_id is null then
    raise exception using errcode = '42501', message = 'active_organization_required';
  end if;
  if not public.has_organization_role(
    v_organization_id,
    array['organization_owner', 'organization_admin']::text[]
  ) then
    raise exception using errcode = '42501', message = 'student_account_link_forbidden';
  end if;
  if p_link_type not in ('manual_verified', 'admin_verified') then
    raise exception using errcode = '22023', message = 'student_account_link_type_not_allowed';
  end if;
  if not exists (
    select 1
    from public.students as student
    where student.id = p_student_id
      and student.organization_id = v_organization_id
      and student.status = 'active'
  ) then
    raise exception using errcode = 'P0002', message = 'canonical_student_not_found';
  end if;
  if not exists (
    select 1
    from public.organization_members as membership
    where membership.organization_id = v_organization_id
      and membership.user_id = p_account_id
      and membership.status = 'active'
  ) then
    raise exception using errcode = '22023', message = 'account_not_active_organization_member';
  end if;

  insert into public.student_account_links (
    organization_id,
    student_id,
    account_id,
    status,
    link_type,
    verified_at,
    valid_from,
    created_by,
    correlation_id
  ) values (
    v_organization_id,
    p_student_id,
    p_account_id,
    'active',
    p_link_type,
    timezone('utc'::text, now()),
    timezone('utc'::text, now()),
    v_actor_id,
    p_correlation_id
  )
  returning id into v_link_id;

  insert into public.student_account_link_audit_events (
    organization_id,
    link_id,
    student_id,
    account_id,
    actor_id,
    action,
    correlation_id,
    metadata
  ) values (
    v_organization_id,
    v_link_id,
    p_student_id,
    p_account_id,
    v_actor_id,
    'STUDENT_ACCOUNT_LINK_CREATED',
    p_correlation_id,
    jsonb_build_object('linkType', p_link_type, 'version', 'le-001.v1')
  );

  return v_link_id;
exception
  when unique_violation then
    raise exception using errcode = '23505', message = 'active_student_account_link_conflict';
end;
$$;

revoke all on function public.create_verified_student_account_link(uuid, uuid, text, uuid)
from public, anon, service_role;
grant execute on function public.create_verified_student_account_link(uuid, uuid, text, uuid)
to authenticated;

create or replace function public.revoke_student_account_link(
  p_link_id uuid,
  p_reason_code text,
  p_correlation_id uuid default gen_random_uuid()
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor_id uuid := auth.uid();
  v_link public.student_account_links%rowtype;
  v_organization_id uuid := public.get_active_organization_id();
begin
  if v_actor_id is null then
    raise exception using errcode = '42501', message = 'authentication_required';
  end if;
  if v_organization_id is null then
    raise exception using errcode = '42501', message = 'active_organization_required';
  end if;
  if not public.has_organization_role(
    v_organization_id,
    array['organization_owner', 'organization_admin']::text[]
  ) then
    raise exception using errcode = '42501', message = 'student_account_link_forbidden';
  end if;
  if p_reason_code is null
    or p_reason_code !~ '^[a-z0-9][a-z0-9_.-]{2,63}$'
  then
    raise exception using errcode = '22023', message = 'invalid_revocation_reason_code';
  end if;

  select link.*
  into v_link
  from public.student_account_links as link
  where link.id = p_link_id
    and link.organization_id = v_organization_id
    and link.status = 'active'
  for update;

  if v_link.id is null then
    raise exception using errcode = 'P0002', message = 'active_student_account_link_not_found';
  end if;

  update public.student_account_links
  set status = 'revoked',
      valid_to = greatest(
        timezone('utc'::text, now()),
        v_link.valid_from + interval '1 microsecond'
      ),
      correlation_id = p_correlation_id
  where id = v_link.id;

  insert into public.student_account_link_audit_events (
    organization_id,
    link_id,
    student_id,
    account_id,
    actor_id,
    action,
    correlation_id,
    metadata
  ) values (
    v_link.organization_id,
    v_link.id,
    v_link.student_id,
    v_link.account_id,
    v_actor_id,
    'STUDENT_ACCOUNT_LINK_REVOKED',
    p_correlation_id,
    jsonb_build_object('reasonCode', p_reason_code, 'version', 'le-001.v1')
  );

  return v_link.id;
end;
$$;

revoke all on function public.revoke_student_account_link(uuid, text, uuid)
from public, anon, service_role;
grant execute on function public.revoke_student_account_link(uuid, text, uuid)
to authenticated;

create or replace function public.resolve_canonical_student_for_authenticated_account()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_account_id uuid := auth.uid();
  v_active_count integer;
  v_link public.student_account_links%rowtype;
  v_organization_id uuid := public.get_active_organization_id();
begin
  if v_account_id is null
    or v_organization_id is null
    or not public.is_active_organization_member(v_organization_id)
  then
    return jsonb_build_object('outcome', 'inactive_context');
  end if;

  select count(*)::integer
  into v_active_count
  from public.student_account_links as link
  where link.account_id = v_account_id
    and link.organization_id = v_organization_id
    and link.status = 'active'
    and link.valid_from <= now()
    and (link.valid_to is null or link.valid_to > now());

  if v_active_count > 1 then
    return jsonb_build_object('outcome', 'ambiguous_link');
  end if;

  if v_active_count = 1 then
    select link.*
    into v_link
    from public.student_account_links as link
    join public.students as student
      on student.id = link.student_id
     and student.organization_id = link.organization_id
     and student.status = 'active'
    where link.account_id = v_account_id
      and link.organization_id = v_organization_id
      and link.status = 'active'
      and link.valid_from <= now()
      and (link.valid_to is null or link.valid_to > now());

    if v_link.id is null then
      return jsonb_build_object('outcome', 'no_link');
    end if;
    return jsonb_build_object(
      'outcome', 'linked',
      'linkId', v_link.id,
      'organizationId', v_link.organization_id,
      'studentId', v_link.student_id
    );
  end if;

  select link.*
  into v_link
  from public.student_account_links as link
  where link.account_id = v_account_id
    and link.organization_id = v_organization_id
  order by link.created_at desc, link.id desc
  limit 1;

  if v_link.status = 'revoked' then
    return jsonb_build_object('outcome', 'revoked_link');
  end if;
  if v_link.status = 'expired'
    or (v_link.status = 'active' and v_link.valid_to <= now())
  then
    return jsonb_build_object('outcome', 'expired_link');
  end if;
  if exists (
    select 1
    from public.student_account_links as other_link
    where other_link.account_id = v_account_id
      and other_link.organization_id <> v_organization_id
      and other_link.status = 'active'
      and other_link.valid_from <= now()
      and (other_link.valid_to is null or other_link.valid_to > now())
  ) then
    return jsonb_build_object('outcome', 'wrong_organization');
  end if;
  return jsonb_build_object('outcome', 'no_link');
end;
$$;

revoke all on function public.resolve_canonical_student_for_authenticated_account()
from public, anon, service_role;
grant execute on function public.resolve_canonical_student_for_authenticated_account()
to authenticated;

create or replace function public.get_learner_convergence_snapshot()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_organization_id uuid := public.get_active_organization_id();
begin
  if auth.uid() is null then
    raise exception using errcode = '42501', message = 'authentication_required';
  end if;
  if v_organization_id is null then
    raise exception using errcode = '42501', message = 'active_organization_required';
  end if;
  if not public.has_organization_role(
    v_organization_id,
    array['organization_owner', 'organization_admin']::text[]
  ) then
    raise exception using errcode = '42501', message = 'learner_parity_forbidden';
  end if;

  return jsonb_build_object(
    'version', 'le-001.v1',
    'organizationId', v_organization_id,
    'asOf', now(),
    'eligibleProfileStudents', coalesce((
      select jsonb_agg(jsonb_build_object(
        'accountId', membership.user_id,
        'organizationId', membership.organization_id,
        'status', membership.status
      ) order by membership.user_id)
      from public.organization_members as membership
      join public.profiles as profile on profile.id = membership.user_id
      where membership.organization_id = v_organization_id
        and membership.role = 'student'
    ), '[]'::jsonb),
    'canonicalStudents', coalesce((
      select jsonb_agg(jsonb_build_object(
        'studentId', student.id,
        'organizationId', student.organization_id,
        'status', student.status
      ) order by student.id)
      from public.students as student
      where student.organization_id = v_organization_id
    ), '[]'::jsonb),
    'accountLinks', coalesce((
      select jsonb_agg(jsonb_build_object(
        'linkId', link.id,
        'organizationId', link.organization_id,
        'studentId', link.student_id,
        'accountId', link.account_id,
        'status', link.status,
        'validFrom', link.valid_from,
        'validTo', link.valid_to
      ) order by link.created_at, link.id)
      from public.student_account_links as link
      where link.organization_id = v_organization_id
    ), '[]'::jsonb),
    'legacyEnrollments', coalesce((
      select jsonb_agg(jsonb_build_object(
        'enrollmentId', enrollment.id,
        'organizationId', enrollment.organization_id,
        'classId', enrollment.class_id,
        'accountId', enrollment.student_id,
        'status', enrollment.status
      ) order by enrollment.id)
      from public.class_enrollments as enrollment
      where enrollment.organization_id = v_organization_id
    ), '[]'::jsonb),
    'canonicalEnrollments', coalesce((
      select jsonb_agg(jsonb_build_object(
        'membershipId', membership.id,
        'organizationId', membership.organization_id,
        'classId', membership.class_id,
        'studentId', membership.student_id,
        'status', membership.status
      ) order by membership.id)
      from public.student_class_members as membership
      where membership.organization_id = v_organization_id
    ), '[]'::jsonb),
    'assignmentRecipients', coalesce((
      select jsonb_agg(jsonb_build_object(
        'assignmentId', recipient.assignment_id,
        'organizationId', recipient.organization_id,
        'accountId', recipient.student_id
      ) order by recipient.assignment_id, recipient.student_id)
      from public.assignment_students as recipient
      where recipient.organization_id = v_organization_id
    ), '[]'::jsonb),
    'submissions', coalesce((
      select jsonb_agg(jsonb_build_object(
        'submissionId', submission.id,
        'assignmentId', submission.assignment_id,
        'organizationId', submission.organization_id,
        'accountId', submission.student_id
      ) order by submission.id)
      from public.assignment_submissions as submission
      where submission.organization_id = v_organization_id
    ), '[]'::jsonb),
    'learningEvents', coalesce((
      select jsonb_agg(jsonb_build_object(
        'eventId', event.id,
        'organizationId', event.organization_id,
        'accountId', event.student_id
      ) order by event.id)
      from public.learning_events as event
      where event.organization_id = v_organization_id
    ), '[]'::jsonb),
    'masteryRecords', coalesce((
      select jsonb_agg(jsonb_build_object(
        'recordId', record.record_id,
        'organizationId', record.organization_id,
        'accountId', record.student_id,
        'recordType', record.record_type
      ) order by record.record_type, record.record_id)
      from (
        select mastery.id as record_id,
               mastery.organization_id,
               mastery.student_id,
               'knowledge_mastery'::text as record_type
        from public.student_knowledge_mastery as mastery
        where mastery.organization_id = v_organization_id
        union all
        select summary.id,
               summary.organization_id,
               summary.student_id,
               'subject_summary'::text
        from public.student_subject_summary as summary
        where summary.organization_id = v_organization_id
      ) as record
    ), '[]'::jsonb),
    'guardianRelationships', coalesce((
      select jsonb_agg(jsonb_build_object(
        'relationshipId', relationship.id,
        'organizationId', relationship.organization_id,
        'legacyStudentAccountId', relationship.student_id,
        'status', relationship.status
      ) order by relationship.id)
      from public.student_guardians as relationship
      where relationship.organization_id = v_organization_id
    ), '[]'::jsonb)
  );
end;
$$;

revoke all on function public.get_learner_convergence_snapshot()
from public, anon, service_role;
grant execute on function public.get_learner_convergence_snapshot()
to authenticated;
