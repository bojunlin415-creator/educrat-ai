-- LE-001 Phase 5F Submission Self-Resolution Canonical Cutover.
-- Additive canonical ownership; historical Profile-keyed columns remain unchanged.
-- Apply only to the approved Development project after review.

create unique index if not exists assignment_submissions_scope_unique
on public.assignment_submissions (id, assignment_id, organization_id);

create table public.assignment_submission_canonical_ownerships (
  submission_id uuid primary key,
  organization_id uuid not null references public.organizations(id) on delete restrict,
  assignment_id uuid not null,
  recipient_id uuid not null,
  student_id uuid not null,
  identity_authority text not null default 'canonical_student' check (
    identity_authority = 'canonical_student'
  ),
  created_at timestamptz not null default timezone('utc'::text, now()),
  constraint assignment_submission_canonical_owner_unique
    unique (assignment_id, student_id),
  constraint assignment_submission_canonical_submission_scope_fk
    foreign key (submission_id, assignment_id, organization_id)
    references public.assignment_submissions(
      id, assignment_id, organization_id
    ) on delete restrict,
  constraint assignment_submission_canonical_recipient_scope_fk
    foreign key (recipient_id, assignment_id, student_id, organization_id)
    references public.assignment_student_recipients(
      id, assignment_id, student_id, organization_id
    ) on delete restrict
);

comment on table public.assignment_submission_canonical_ownerships is
  'LE-001 Phase 5F authoritative canonical Student ownership for Submission rows. Historical assignment_submissions.student_id remains a Profile identifier.';
comment on column public.assignment_submission_canonical_ownerships.student_id is
  'Canonical students.id. Never stores a Profile or Auth Account identifier.';

create index assignment_submission_canonical_student_idx
on public.assignment_submission_canonical_ownerships (
  organization_id, student_id, assignment_id
);

alter table public.assignment_submission_canonical_ownerships
enable row level security;
alter table public.assignment_submission_canonical_ownerships
force row level security;

revoke all on table public.assignment_submission_canonical_ownerships
from public, anon, authenticated;

create or replace function public.is_authenticated_canonical_assignment_recipient(
  p_assignment_id uuid,
  p_organization_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select auth.uid() is not null
    and p_organization_id = public.get_active_organization_id()
    and public.has_organization_role(
      p_organization_id,
      array['student']::text[]
    )
    and exists (
      select 1
      from public.student_account_links as link
      join public.students as student
        on student.id = link.student_id
       and student.organization_id = link.organization_id
       and student.status = 'active'
      join public.assignment_student_recipients as recipient
        on recipient.organization_id = link.organization_id
       and recipient.student_id = link.student_id
       and recipient.assignment_id = p_assignment_id
       and recipient.status in ('not_started', 'in_progress', 'overdue', 'submitted')
      where link.account_id = auth.uid()
        and link.organization_id = p_organization_id
        and link.status = 'active'
        and link.verified_at is not null
        and link.valid_from <= timezone('utc'::text, now())
        and (link.valid_to is null or link.valid_to > timezone('utc'::text, now()))
    );
$$;

create or replace function public.can_authenticated_access_assignment(
  p_assignment_id uuid,
  p_organization_id uuid,
  p_assigned_by uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select auth.uid() is not null
    and p_organization_id = public.get_active_organization_id()
    and public.is_active_organization_member(p_organization_id)
    and (
      public.has_organization_role(
        p_organization_id,
        array['organization_owner', 'organization_admin']::text[]
      )
      or p_assigned_by = auth.uid()
      or public.is_authenticated_canonical_assignment_recipient(
        p_assignment_id,
        p_organization_id
      )
      or exists (
        select 1
        from public.assignment_students as legacy
        where legacy.assignment_id = p_assignment_id
          and legacy.organization_id = p_organization_id
          and legacy.student_id = auth.uid()
          and not exists (
            select 1
            from public.assignment_recipient_legacy_compatibility as compatibility
            where compatibility.assignment_id = legacy.assignment_id
              and compatibility.organization_id = legacy.organization_id
              and compatibility.legacy_student_id = legacy.student_id
          )
      )
    );
$$;

create or replace function public.can_authenticated_read_assignment_submission(
  p_submission_id uuid,
  p_assignment_id uuid,
  p_organization_id uuid,
  p_legacy_student_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select auth.uid() is not null
    and p_organization_id = public.get_active_organization_id()
    and public.is_active_organization_member(p_organization_id)
    and (
      public.has_organization_role(
        p_organization_id,
        array['organization_owner', 'organization_admin']::text[]
      )
      or public.is_assignment_manager(
        p_assignment_id,
        p_organization_id,
        auth.uid()
      )
      or exists (
        select 1
        from public.assignment_submission_canonical_ownerships as ownership
        join public.student_account_links as link
          on link.organization_id = ownership.organization_id
         and link.student_id = ownership.student_id
         and link.account_id = auth.uid()
         and link.status = 'active'
         and link.verified_at is not null
         and link.valid_from <= timezone('utc'::text, now())
         and (link.valid_to is null or link.valid_to > timezone('utc'::text, now()))
        join public.students as student
          on student.id = ownership.student_id
         and student.organization_id = ownership.organization_id
         and student.status = 'active'
        where ownership.submission_id = p_submission_id
          and ownership.assignment_id = p_assignment_id
          and ownership.organization_id = p_organization_id
      )
      or (
        p_legacy_student_id = auth.uid()
        and not exists (
          select 1
          from public.assignment_submission_canonical_ownerships as ownership
          where ownership.submission_id = p_submission_id
        )
        and (
          not exists (
            select 1
            from public.assignment_recipient_legacy_compatibility as compatibility
            where compatibility.assignment_id = p_assignment_id
              and compatibility.organization_id = p_organization_id
              and compatibility.legacy_student_id = p_legacy_student_id
          )
          or exists (
            select 1
            from public.assignment_recipient_legacy_compatibility as compatibility
            join public.student_account_links as link
              on link.id = compatibility.student_account_link_id
             and link.organization_id = compatibility.organization_id
             and link.student_id = compatibility.student_id
             and link.account_id = compatibility.legacy_student_id
            join public.students as student
              on student.id = link.student_id
             and student.organization_id = link.organization_id
             and student.status = 'active'
            where compatibility.assignment_id = p_assignment_id
              and compatibility.organization_id = p_organization_id
              and compatibility.legacy_student_id = p_legacy_student_id
              and link.status = 'active'
              and link.verified_at is not null
              and link.valid_from <= timezone('utc'::text, now())
              and (link.valid_to is null or link.valid_to > timezone('utc'::text, now()))
          )
        )
      )
    );
$$;

create or replace function public.can_authenticated_read_legacy_assignment_recipient(
  p_assignment_id uuid,
  p_organization_id uuid,
  p_legacy_student_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select auth.uid() is not null
    and p_organization_id = public.get_active_organization_id()
    and public.is_active_organization_member(p_organization_id)
    and (
      public.has_organization_role(
        p_organization_id,
        array['organization_owner', 'organization_admin']::text[]
      )
      or public.is_assignment_manager(
        p_assignment_id,
        p_organization_id,
        auth.uid()
      )
      or (
        p_legacy_student_id = auth.uid()
        and (
          not exists (
            select 1
            from public.assignment_recipient_legacy_compatibility as compatibility
            where compatibility.assignment_id = p_assignment_id
              and compatibility.organization_id = p_organization_id
              and compatibility.legacy_student_id = p_legacy_student_id
          )
          or exists (
            select 1
            from public.assignment_recipient_legacy_compatibility as compatibility
            join public.student_account_links as link
              on link.id = compatibility.student_account_link_id
             and link.organization_id = compatibility.organization_id
             and link.student_id = compatibility.student_id
             and link.account_id = compatibility.legacy_student_id
            join public.students as student
              on student.id = link.student_id
             and student.organization_id = link.organization_id
             and student.status = 'active'
            where compatibility.assignment_id = p_assignment_id
              and compatibility.organization_id = p_organization_id
              and compatibility.legacy_student_id = p_legacy_student_id
              and link.status = 'active'
              and link.verified_at is not null
              and link.valid_from <= timezone('utc'::text, now())
              and (link.valid_to is null or link.valid_to > timezone('utc'::text, now()))
          )
        )
      )
    );
$$;

revoke all on function public.is_authenticated_canonical_assignment_recipient(uuid, uuid)
from public, anon, service_role;
revoke all on function public.can_authenticated_access_assignment(uuid, uuid, uuid)
from public, anon, service_role;
revoke all on function public.can_authenticated_read_assignment_submission(
  uuid, uuid, uuid, uuid
) from public, anon, service_role;
revoke all on function public.can_authenticated_read_legacy_assignment_recipient(
  uuid, uuid, uuid
) from public, anon, service_role;

grant execute on function public.is_authenticated_canonical_assignment_recipient(uuid, uuid)
to authenticated;
grant execute on function public.can_authenticated_access_assignment(uuid, uuid, uuid)
to authenticated;
grant execute on function public.can_authenticated_read_assignment_submission(
  uuid, uuid, uuid, uuid
) to authenticated;
grant execute on function public.can_authenticated_read_legacy_assignment_recipient(
  uuid, uuid, uuid
) to authenticated;

drop policy if exists "assignments_select_member" on public.assignments;
create policy "assignments_select_member"
on public.assignments
for select
to authenticated
using (
  public.can_authenticated_access_assignment(
    assignments.id,
    assignments.organization_id,
    assignments.assigned_by
  )
);

drop policy if exists "assignment_submissions_select_scoped"
on public.assignment_submissions;
create policy "assignment_submissions_select_scoped"
on public.assignment_submissions
for select
to authenticated
using (
  public.can_authenticated_read_assignment_submission(
    assignment_submissions.id,
    assignment_submissions.assignment_id,
    assignment_submissions.organization_id,
    assignment_submissions.student_id
  )
);

drop policy if exists "assignment_students_select_scoped"
on public.assignment_students;
create policy "assignment_students_select_scoped"
on public.assignment_students
for select
to authenticated
using (
  public.can_authenticated_read_legacy_assignment_recipient(
    assignment_students.assignment_id,
    assignment_students.organization_id,
    assignment_students.student_id
  )
);

create or replace function public.get_authenticated_student_assignment_recipients(
  p_assignment_id uuid default null
)
returns table (
  recipient_id uuid,
  assignment_id uuid,
  canonical_student_id uuid,
  identity_authority text,
  recipient_status text,
  source_class_ids uuid[],
  assigned_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_account_id uuid := auth.uid();
  v_organization_id uuid := public.get_active_organization_id();
  v_effective_link_count integer := 0;
  v_student_id uuid;
begin
  if v_account_id is null then
    raise exception using errcode = '42501', message = 'authentication_required';
  end if;
  if v_organization_id is null
    or not public.has_organization_role(
      v_organization_id,
      array['student']::text[]
    )
  then
    raise exception using errcode = '42501', message = 'submission_self_forbidden';
  end if;

  select count(*)::integer
  into v_effective_link_count
  from public.student_account_links as link
  join public.students as student
    on student.id = link.student_id
   and student.organization_id = link.organization_id
   and student.status = 'active'
  where link.account_id = v_account_id
    and link.organization_id = v_organization_id
    and link.status = 'active'
    and link.verified_at is not null
    and link.valid_from <= timezone('utc'::text, now())
    and (link.valid_to is null or link.valid_to > timezone('utc'::text, now()));

  if v_effective_link_count > 1 then
    raise exception using errcode = 'P0001', message = 'student_identity_conflict';
  end if;
  if v_effective_link_count = 1 then
    select link.student_id
    into v_student_id
    from public.student_account_links as link
    join public.students as student
      on student.id = link.student_id
     and student.organization_id = link.organization_id
     and student.status = 'active'
    where link.account_id = v_account_id
      and link.organization_id = v_organization_id
      and link.status = 'active'
      and link.verified_at is not null
      and link.valid_from <= timezone('utc'::text, now())
      and (link.valid_to is null or link.valid_to > timezone('utc'::text, now()));
  else
    v_student_id := null;
  end if;

  return query
  select projection.recipient_id,
         projection.assignment_id,
         projection.canonical_student_id,
         projection.identity_authority,
         projection.recipient_status,
         projection.source_class_ids,
         projection.assigned_at
  from (
    select recipient.id as recipient_id,
           recipient.assignment_id,
           recipient.student_id as canonical_student_id,
           upper(recipient.identity_authority) as identity_authority,
           recipient.status as recipient_status,
           coalesce(
             array_agg(distinct origin.class_id order by origin.class_id)
               filter (where origin.class_id is not null),
             '{}'::uuid[]
           ) as source_class_ids,
           recipient.assigned_at
    from public.assignment_student_recipients as recipient
    left join public.assignment_recipient_classes as origin
      on origin.recipient_id = recipient.id
     and origin.organization_id = recipient.organization_id
    where v_student_id is not null
      and recipient.student_id = v_student_id
      and recipient.organization_id = v_organization_id
      and (p_assignment_id is null or recipient.assignment_id = p_assignment_id)
    group by recipient.id

    union all

    select null::uuid as recipient_id,
           legacy.assignment_id,
           null::uuid as canonical_student_id,
           'LEGACY_ONLY_HISTORICAL'::text as identity_authority,
           legacy.status as recipient_status,
           '{}'::uuid[] as source_class_ids,
           legacy.assigned_at
    from public.assignment_students as legacy
    where legacy.student_id = v_account_id
      and legacy.organization_id = v_organization_id
      and (p_assignment_id is null or legacy.assignment_id = p_assignment_id)
      and not exists (
        select 1
        from public.assignment_recipient_legacy_compatibility as compatibility
        where compatibility.assignment_id = legacy.assignment_id
          and compatibility.organization_id = legacy.organization_id
          and compatibility.legacy_student_id = legacy.student_id
      )
  ) as projection
  order by projection.assigned_at desc, projection.recipient_id nulls last;
end;
$$;

revoke all on function public.get_authenticated_student_assignment_recipients(uuid)
from public, anon, service_role;
grant execute on function public.get_authenticated_student_assignment_recipients(uuid)
to authenticated;

create or replace function public.persist_authenticated_student_submission(
  p_assignment_id uuid,
  p_content jsonb,
  p_submit boolean,
  p_use_canonical_identity boolean
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_account_id uuid := auth.uid();
  v_organization_id uuid := public.get_active_organization_id();
  v_now timestamptz := timezone('utc'::text, now());
  v_assignment public.assignments%rowtype;
  v_recipient public.assignment_student_recipients%rowtype;
  v_submission public.assignment_submissions%rowtype;
  v_link public.student_account_links%rowtype;
  v_effective_link_count integer := 0;
  v_latest_link public.student_account_links%rowtype;
  v_has_legacy_recipient boolean := false;
begin
  if v_account_id is null then
    raise exception using errcode = '42501', message = 'authentication_required';
  end if;
  if v_organization_id is null
    or not public.has_organization_role(
      v_organization_id,
      array['student']::text[]
    )
  then
    raise exception using errcode = '42501', message = 'submission_self_forbidden';
  end if;
  if p_assignment_id is null
    or p_submit is null
    or p_use_canonical_identity is null
    or p_content is null
    or jsonb_typeof(p_content) <> 'object'
    or octet_length(p_content::text) > 16000
  then
    raise exception using errcode = '22023', message = 'submission_invalid_input';
  end if;

  select assignment.*
  into v_assignment
  from public.assignments as assignment
  where assignment.id = p_assignment_id
    and assignment.organization_id = v_organization_id
  for update;

  if v_assignment.id is null then
    if exists (
      select 1 from public.assignments as other_assignment
      where other_assignment.id = p_assignment_id
        and other_assignment.organization_id <> v_organization_id
    ) then
      raise exception using errcode = '42501', message = 'cross_tenant_forbidden';
    end if;
    raise exception using errcode = 'P0002', message = 'assignment_recipient_not_found';
  end if;
  if v_assignment.status not in ('scheduled', 'active')
    or v_assignment.publish_at > v_now
  then
    raise exception using errcode = '22023', message = 'submission_not_allowed';
  end if;

  if p_use_canonical_identity then
    select count(*)::integer
    into v_effective_link_count
    from public.student_account_links as link
    join public.students as student
      on student.id = link.student_id
     and student.organization_id = link.organization_id
     and student.status = 'active'
    where link.account_id = v_account_id
      and link.organization_id = v_organization_id
      and link.status = 'active'
      and link.verified_at is not null
      and link.valid_from <= v_now
      and (link.valid_to is null or link.valid_to > v_now);

    if v_effective_link_count > 1 then
      raise exception using errcode = 'P0001', message = 'student_identity_conflict';
    end if;
    if v_effective_link_count = 1 then
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
        and link.verified_at is not null
        and link.valid_from <= v_now
        and (link.valid_to is null or link.valid_to > v_now)
      for share of link;
    else
      select link.*
      into v_latest_link
      from public.student_account_links as link
      where link.account_id = v_account_id
        and link.organization_id = v_organization_id
      order by link.created_at desc, link.id desc
      limit 1;

      if v_latest_link.status = 'revoked' then
        raise exception using errcode = 'P0001', message = 'student_account_link_inactive';
      end if;
      if v_latest_link.status = 'expired'
        or (
          v_latest_link.status = 'active'
          and v_latest_link.valid_to is not null
          and v_latest_link.valid_to <= v_now
        )
      then
        raise exception using errcode = 'P0001', message = 'student_account_link_expired';
      end if;
      if v_latest_link.id is null then
        raise exception using errcode = 'P0001', message = 'student_account_link_missing';
      end if;
      raise exception using errcode = 'P0001', message = 'student_account_link_inactive';
    end if;

    select recipient.*
    into v_recipient
    from public.assignment_student_recipients as recipient
    where recipient.assignment_id = p_assignment_id
      and recipient.organization_id = v_organization_id
      and recipient.student_id = v_link.student_id
    for update;

    if v_recipient.id is null then
      raise exception using errcode = 'P0002', message = 'assignment_recipient_not_found';
    end if;
    if v_recipient.status = 'submitted' then
      raise exception using errcode = '22023', message = 'submission_locked';
    end if;
  else
    select exists (
      select 1
      from public.assignment_students as legacy
      where legacy.assignment_id = p_assignment_id
        and legacy.organization_id = v_organization_id
        and legacy.student_id = v_account_id
        and legacy.status in ('not_started', 'in_progress', 'overdue')
    ) into v_has_legacy_recipient;

    if not v_has_legacy_recipient then
      raise exception using errcode = 'P0002', message = 'assignment_recipient_not_found';
    end if;
    if exists (
      select 1
      from public.assignment_recipient_legacy_compatibility as compatibility
      join public.student_account_links as link
        on link.id = compatibility.student_account_link_id
       and link.organization_id = compatibility.organization_id
       and link.account_id = compatibility.legacy_student_id
      where compatibility.assignment_id = p_assignment_id
        and compatibility.organization_id = v_organization_id
        and compatibility.legacy_student_id = v_account_id
        and not (
          link.status = 'active'
          and link.verified_at is not null
          and link.valid_from <= v_now
          and (link.valid_to is null or link.valid_to > v_now)
        )
    ) then
      raise exception using errcode = 'P0001', message = 'student_account_link_inactive';
    end if;
  end if;

  select submission.*
  into v_submission
  from public.assignment_submissions as submission
  where submission.assignment_id = p_assignment_id
    and submission.organization_id = v_organization_id
    and submission.student_id = v_account_id
  for update;

  if v_submission.id is not null and v_submission.status = 'submitted' then
    raise exception using errcode = '22023', message = 'submission_locked';
  end if;

  if v_submission.id is null then
    insert into public.assignment_submissions (
      organization_id,
      assignment_id,
      student_id,
      content,
      status,
      submitted_at
    ) values (
      v_organization_id,
      p_assignment_id,
      v_account_id,
      p_content,
      case when p_submit then 'submitted' else 'draft' end,
      case when p_submit then v_now else null end
    ) returning * into v_submission;
  else
    update public.assignment_submissions
    set content = p_content,
        status = case when p_submit then 'submitted' else 'draft' end,
        submitted_at = case when p_submit then v_now else null end
    where id = v_submission.id
    returning * into v_submission;
  end if;

  if p_use_canonical_identity then
    insert into public.assignment_submission_canonical_ownerships (
      submission_id,
      organization_id,
      assignment_id,
      recipient_id,
      student_id
    ) values (
      v_submission.id,
      v_organization_id,
      p_assignment_id,
      v_recipient.id,
      v_recipient.student_id
    )
    on conflict (submission_id) do nothing;

    if not exists (
      select 1
      from public.assignment_submission_canonical_ownerships as ownership
      where ownership.submission_id = v_submission.id
        and ownership.organization_id = v_organization_id
        and ownership.assignment_id = p_assignment_id
        and ownership.recipient_id = v_recipient.id
        and ownership.student_id = v_recipient.student_id
    ) then
      raise exception using errcode = 'P0001', message = 'student_identity_conflict';
    end if;

    update public.assignment_student_recipients
    set status = case when p_submit then 'submitted' else 'in_progress' end
    where id = v_recipient.id;
  end if;

  update public.assignment_students
  set opened_at = coalesce(opened_at, v_now),
      submitted_at = case when p_submit then v_now else submitted_at end,
      status = case when p_submit then 'submitted' else 'in_progress' end
  where assignment_id = p_assignment_id
    and organization_id = v_organization_id
    and student_id = v_account_id;

  if p_submit then
    insert into public.assignment_audit_events (
      organization_id,
      assignment_id,
      actor_id,
      action,
      metadata
    ) values (
      v_organization_id,
      p_assignment_id,
      v_account_id,
      'ASSIGNMENT_SUBMITTED',
      jsonb_build_object(
        'identityAuthority',
        case when p_use_canonical_identity then 'canonical_student' else 'legacy_profile' end,
        'source', 'le001_phase5f'
      )
    );
  end if;

  return jsonb_build_object(
    'assignment_id', v_submission.assignment_id,
    'created_at', v_submission.created_at,
    'id', v_submission.id,
    'identity_authority',
      case when p_use_canonical_identity then 'CANONICAL' else 'LEGACY_ONLY_HISTORICAL' end,
    'status', v_submission.status,
    'submitted_at', v_submission.submitted_at,
    'updated_at', v_submission.updated_at
  );
end;
$$;

revoke all on function public.persist_authenticated_student_submission(
  uuid, jsonb, boolean, boolean
) from public, anon, authenticated, service_role;

create or replace function public.save_authenticated_student_submission(
  p_assignment_id uuid,
  p_content jsonb,
  p_submit boolean
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  return public.persist_authenticated_student_submission(
    p_assignment_id,
    p_content,
    p_submit,
    true
  );
end;
$$;

create or replace function public.save_legacy_authenticated_student_submission(
  p_assignment_id uuid,
  p_content jsonb,
  p_submit boolean
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  return public.persist_authenticated_student_submission(
    p_assignment_id,
    p_content,
    p_submit,
    false
  );
end;
$$;

revoke all on function public.save_authenticated_student_submission(uuid, jsonb, boolean)
from public, anon, service_role;
revoke all on function public.save_legacy_authenticated_student_submission(
  uuid, jsonb, boolean
) from public, anon, service_role;

grant execute on function public.save_authenticated_student_submission(
  uuid, jsonb, boolean
) to authenticated;
grant execute on function public.save_legacy_authenticated_student_submission(
  uuid, jsonb, boolean
) to authenticated;

revoke insert, update on table public.assignment_submissions from authenticated;
drop policy if exists "assignment_submissions_insert_student"
on public.assignment_submissions;
drop policy if exists "assignment_submissions_update_student_draft"
on public.assignment_submissions;
