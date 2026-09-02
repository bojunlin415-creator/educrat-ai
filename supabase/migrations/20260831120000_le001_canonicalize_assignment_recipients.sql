-- LE-001 Phase 5E Assignment Recipient Canonicalization.
-- Additive canonical recipient authority for students.id.
-- Historical assignment_students.student_id remains a Profile identifier.
-- Apply only to the approved Development project after review.

create unique index if not exists assignments_id_organization_unique
on public.assignments (id, organization_id);

create unique index if not exists assignment_classes_scope_unique
on public.assignment_classes (assignment_id, class_id, organization_id);

create unique index if not exists student_class_members_provenance_unique
on public.student_class_members (id, class_id, student_id, organization_id);

create unique index if not exists student_account_links_compatibility_unique
on public.student_account_links (id, organization_id, student_id, account_id);

create table public.assignment_student_recipients (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  assignment_id uuid not null,
  student_id uuid not null,
  identity_authority text not null default 'canonical' check (
    identity_authority in (
      'canonical',
      'canonical_with_legacy_compatibility'
    )
  ),
  status text not null default 'not_started' check (
    status in ('not_started', 'in_progress', 'submitted', 'overdue')
  ),
  assigned_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now()),
  constraint assignment_student_recipients_unique
    unique (assignment_id, student_id),
  constraint assignment_student_recipients_scope_unique
    unique (id, assignment_id, student_id, organization_id),
  constraint assignment_student_recipients_assignment_tenant_fk
    foreign key (assignment_id, organization_id)
    references public.assignments(id, organization_id) on delete restrict,
  constraint assignment_student_recipients_student_tenant_fk
    foreign key (student_id, organization_id)
    references public.students(id, organization_id) on delete restrict
);

comment on table public.assignment_student_recipients is
  'LE-001 Phase 5E canonical Assignment recipient snapshot keyed by students.id.';
comment on column public.assignment_student_recipients.student_id is
  'Canonical students.id. This never stores a Profile or Auth user identifier.';

create table public.assignment_recipient_classes (
  recipient_id uuid not null,
  organization_id uuid not null,
  assignment_id uuid not null,
  student_id uuid not null,
  class_id uuid not null,
  membership_id uuid not null,
  assigned_at timestamptz not null default timezone('utc'::text, now()),
  primary key (recipient_id, class_id),
  constraint assignment_recipient_classes_recipient_scope_fk
    foreign key (recipient_id, assignment_id, student_id, organization_id)
    references public.assignment_student_recipients(
      id, assignment_id, student_id, organization_id
    ) on delete restrict,
  constraint assignment_recipient_classes_assignment_class_scope_fk
    foreign key (assignment_id, class_id, organization_id)
    references public.assignment_classes(
      assignment_id, class_id, organization_id
    ) on delete restrict,
  constraint assignment_recipient_classes_membership_scope_fk
    foreign key (membership_id, class_id, student_id, organization_id)
    references public.student_class_members(
      id, class_id, student_id, organization_id
    ) on delete restrict
);

comment on table public.assignment_recipient_classes is
  'Class and canonical membership provenance captured when an Assignment recipient is materialized.';

create table public.assignment_recipient_legacy_compatibility (
  recipient_id uuid primary key,
  organization_id uuid not null,
  assignment_id uuid not null,
  student_id uuid not null,
  student_account_link_id uuid not null,
  legacy_student_id uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default timezone('utc'::text, now()),
  constraint assignment_recipient_legacy_scope_unique
    unique (assignment_id, legacy_student_id),
  constraint assignment_recipient_legacy_recipient_scope_fk
    foreign key (recipient_id, assignment_id, student_id, organization_id)
    references public.assignment_student_recipients(
      id, assignment_id, student_id, organization_id
    ) on delete restrict,
  constraint assignment_recipient_legacy_link_scope_fk
    foreign key (
      student_account_link_id, organization_id, student_id, legacy_student_id
    ) references public.student_account_links(
      id, organization_id, student_id, account_id
    ) on delete restrict
);

comment on table public.assignment_recipient_legacy_compatibility is
  'Server-only verified compatibility projection to the legacy Profile-keyed recipient boundary.';

create index assignment_student_recipients_scope_idx
on public.assignment_student_recipients (
  organization_id, assignment_id, status, assigned_at
);

create index assignment_student_recipients_student_idx
on public.assignment_student_recipients (
  organization_id, student_id, status, assigned_at desc
);

create index assignment_recipient_classes_scope_idx
on public.assignment_recipient_classes (
  organization_id, assignment_id, class_id, student_id
);

create index assignment_recipient_legacy_scope_idx
on public.assignment_recipient_legacy_compatibility (
  organization_id, assignment_id, student_id
);

create trigger assignment_student_recipients_set_updated_at
before update on public.assignment_student_recipients
for each row execute function public.set_updated_at();

alter table public.assignment_student_recipients enable row level security;
alter table public.assignment_student_recipients force row level security;
alter table public.assignment_recipient_classes enable row level security;
alter table public.assignment_recipient_classes force row level security;
alter table public.assignment_recipient_legacy_compatibility enable row level security;
alter table public.assignment_recipient_legacy_compatibility force row level security;

revoke all on table public.assignment_student_recipients from anon, authenticated;
revoke all on table public.assignment_recipient_classes from anon, authenticated;
revoke all on table public.assignment_recipient_legacy_compatibility from anon, authenticated;

grant select on table public.assignment_student_recipients to authenticated;
grant select on table public.assignment_recipient_classes to authenticated;

create policy "assignment_student_recipients_select_manager"
on public.assignment_student_recipients
for select
to authenticated
using (
  public.is_active_organization_member(organization_id)
  and (
    public.has_organization_role(
      organization_id,
      array['organization_owner', 'organization_admin']::text[]
    )
    or public.is_assignment_manager(
      assignment_id,
      organization_id,
      (select auth.uid())
    )
  )
);

create policy "assignment_recipient_classes_select_manager"
on public.assignment_recipient_classes
for select
to authenticated
using (
  public.is_active_organization_member(organization_id)
  and (
    public.has_organization_role(
      organization_id,
      array['organization_owner', 'organization_admin']::text[]
    )
    or public.is_assignment_manager(
      assignment_id,
      organization_id,
      (select auth.uid())
    )
  )
);

create or replace function public.persist_assignment_canonical_recipient_snapshot(
  p_assignment_id uuid,
  p_class_ids uuid[],
  p_expected_class_student_ids uuid[],
  p_direct_student_ids uuid[],
  p_write_legacy_compatibility boolean
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor_id uuid := auth.uid();
  v_organization_id uuid := public.get_active_organization_id();
  v_assignment public.assignments%rowtype;
  v_class_ids uuid[];
  v_expected_class_student_ids uuid[];
  v_actual_class_student_ids uuid[];
  v_direct_student_ids uuid[];
  v_all_student_ids uuid[];
  v_can_manage_all boolean;
  v_new_recipient_count integer := 0;
  v_compatibility_count integer := 0;
begin
  if v_actor_id is null then
    raise exception using errcode = '42501', message = 'authentication_required';
  end if;
  if v_organization_id is null then
    raise exception using errcode = '42501', message = 'active_organization_required';
  end if;
  if p_assignment_id is null
    or p_write_legacy_compatibility is null
    or array_position(coalesce(p_class_ids, '{}'::uuid[]), null) is not null
    or array_position(coalesce(p_expected_class_student_ids, '{}'::uuid[]), null) is not null
    or array_position(coalesce(p_direct_student_ids, '{}'::uuid[]), null) is not null
  then
    raise exception using errcode = '22023', message = 'assignment_recipient_invalid_input';
  end if;

  select coalesce(array_agg(distinct item order by item), '{}'::uuid[])
  into v_class_ids
  from unnest(coalesce(p_class_ids, '{}'::uuid[])) as values_(item);

  select coalesce(array_agg(distinct item order by item), '{}'::uuid[])
  into v_expected_class_student_ids
  from unnest(coalesce(p_expected_class_student_ids, '{}'::uuid[])) as values_(item);

  select coalesce(array_agg(distinct item order by item), '{}'::uuid[])
  into v_direct_student_ids
  from unnest(coalesce(p_direct_student_ids, '{}'::uuid[])) as values_(item);

  if cardinality(v_class_ids) > 200
    or cardinality(v_expected_class_student_ids) > 200
    or cardinality(v_direct_student_ids) > 200
  then
    raise exception using errcode = '22023', message = 'assignment_recipient_invalid_input';
  end if;

  select *
  into v_assignment
  from public.assignments as assignment
  where assignment.id = p_assignment_id
    and assignment.organization_id = v_organization_id;

  if v_assignment.id is null then
    raise exception using errcode = 'P0002', message = 'assignment_not_found';
  end if;

  v_can_manage_all := public.has_organization_role(
    v_organization_id,
    array['organization_owner', 'organization_admin']::text[]
  );

  if not v_can_manage_all and not (
    v_assignment.assigned_by = v_actor_id
    and public.has_organization_role(
      v_organization_id,
      array['teacher']::text[]
    )
  ) then
    raise exception using errcode = '42501', message = 'assignment_recipient_forbidden';
  end if;

  if v_assignment.status in ('cancelled', 'closed') then
    raise exception using errcode = '22023', message = 'assignment_state_locked';
  end if;

  if exists (
    select 1
    from unnest(v_class_ids) as requested(class_id)
    left join public.classes as classroom
      on classroom.id = requested.class_id
      and classroom.organization_id = v_organization_id
      and classroom.status = 'active'
    where classroom.id is null
      or (not v_can_manage_all and classroom.teacher_id <> v_actor_id)
  ) then
    raise exception using errcode = '22023', message = 'assignment_invalid_class';
  end if;

  select coalesce(array_agg(distinct membership.student_id order by membership.student_id), '{}'::uuid[])
  into v_actual_class_student_ids
  from public.student_class_members as membership
  join public.students as student
    on student.id = membership.student_id
    and student.organization_id = membership.organization_id
    and student.status = 'active'
  where membership.organization_id = v_organization_id
    and membership.class_id = any(v_class_ids)
    and membership.status = 'active';

  if v_actual_class_student_ids is distinct from v_expected_class_student_ids then
    raise exception using errcode = '40001', message = 'assignment_recipient_snapshot_changed';
  end if;

  if exists (
    select 1
    from unnest(v_direct_student_ids) as requested(student_id)
    left join public.students as student
      on student.id = requested.student_id
      and student.organization_id = v_organization_id
      and student.status = 'active'
    where student.id is null
  ) then
    raise exception using errcode = 'P0002', message = 'recipient_not_found';
  end if;

  select coalesce(array_agg(distinct item order by item), '{}'::uuid[])
  into v_all_student_ids
  from unnest(v_expected_class_student_ids || v_direct_student_ids) as values_(item);

  insert into public.assignment_classes (
    assignment_id,
    organization_id,
    class_id
  )
  select p_assignment_id, v_organization_id, class_id
  from unnest(v_class_ids) as requested(class_id)
  on conflict (assignment_id, class_id) do nothing;

  insert into public.assignment_student_recipients (
    organization_id,
    assignment_id,
    student_id
  )
  select v_organization_id, p_assignment_id, student_id
  from unnest(v_all_student_ids) as requested(student_id)
  on conflict (assignment_id, student_id) do nothing;
  get diagnostics v_new_recipient_count = row_count;

  insert into public.assignment_recipient_classes (
    recipient_id,
    organization_id,
    assignment_id,
    student_id,
    class_id,
    membership_id
  )
  select recipient.id,
         v_organization_id,
         p_assignment_id,
         recipient.student_id,
         membership.class_id,
         membership.id
  from public.assignment_student_recipients as recipient
  join public.student_class_members as membership
    on membership.organization_id = recipient.organization_id
    and membership.student_id = recipient.student_id
    and membership.status = 'active'
    and membership.class_id = any(v_class_ids)
  where recipient.assignment_id = p_assignment_id
    and recipient.organization_id = v_organization_id
  on conflict (recipient_id, class_id) do nothing;

  if p_write_legacy_compatibility then
    insert into public.assignment_recipient_legacy_compatibility (
      recipient_id,
      organization_id,
      assignment_id,
      student_id,
      student_account_link_id,
      legacy_student_id
    )
    select recipient.id,
           recipient.organization_id,
           recipient.assignment_id,
           recipient.student_id,
           link.id,
           link.account_id
    from public.assignment_student_recipients as recipient
    join public.student_account_links as link
      on link.organization_id = recipient.organization_id
      and link.student_id = recipient.student_id
      and link.status = 'active'
      and link.verified_at is not null
      and link.valid_from <= timezone('utc'::text, now())
      and (link.valid_to is null or link.valid_to > timezone('utc'::text, now()))
    join public.profiles as profile
      on profile.id = link.account_id
    join public.organization_members as membership
      on membership.organization_id = recipient.organization_id
      and membership.user_id = link.account_id
      and membership.role = 'student'
      and membership.status = 'active'
    where recipient.assignment_id = p_assignment_id
      and recipient.organization_id = v_organization_id
    on conflict (recipient_id) do nothing;

    update public.assignment_student_recipients as recipient
    set identity_authority = 'canonical_with_legacy_compatibility'
    where recipient.assignment_id = p_assignment_id
      and recipient.organization_id = v_organization_id
      and exists (
        select 1
        from public.assignment_recipient_legacy_compatibility as compatibility
        where compatibility.recipient_id = recipient.id
      );

    insert into public.assignment_students (
      assignment_id,
      organization_id,
      student_id
    )
    select compatibility.assignment_id,
           compatibility.organization_id,
           compatibility.legacy_student_id
    from public.assignment_recipient_legacy_compatibility as compatibility
    where compatibility.assignment_id = p_assignment_id
      and compatibility.organization_id = v_organization_id
    on conflict (assignment_id, student_id) do nothing;
  end if;

  select count(*)::integer
  into v_compatibility_count
  from public.assignment_recipient_legacy_compatibility as compatibility
  where compatibility.assignment_id = p_assignment_id
    and compatibility.organization_id = v_organization_id;

  if cardinality(v_all_student_ids) > 0 then
    insert into public.assignment_audit_events (
      organization_id,
      assignment_id,
      actor_id,
      action,
      metadata
    ) values (
      v_organization_id,
      p_assignment_id,
      v_actor_id,
      'ASSIGNMENT_ASSIGNED',
      jsonb_build_object(
        'canonicalRecipientCount', cardinality(v_all_student_ids),
        'newCanonicalRecipientCount', v_new_recipient_count,
        'legacyCompatibilityCount', v_compatibility_count,
        'source', 'le001_phase5e'
      )
    );
  end if;

  return jsonb_build_object(
    'assignmentId', p_assignment_id,
    'canonicalRecipientCount', cardinality(v_all_student_ids),
    'newCanonicalRecipientCount', v_new_recipient_count,
    'legacyCompatibilityCount', v_compatibility_count
  );
end;
$$;

revoke all on function public.persist_assignment_canonical_recipient_snapshot(
  uuid, uuid[], uuid[], uuid[], boolean
) from public, anon, authenticated, service_role;

create or replace function public.create_assignment_with_canonical_recipients(
  p_curriculum_id uuid,
  p_curriculum_version_id uuid,
  p_title text,
  p_description text,
  p_publish_at timestamptz,
  p_due_at timestamptz,
  p_class_ids uuid[],
  p_expected_class_student_ids uuid[],
  p_direct_student_ids uuid[],
  p_write_legacy_compatibility boolean
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor_id uuid := auth.uid();
  v_organization_id uuid := public.get_active_organization_id();
  v_assignment_id uuid;
begin
  if v_actor_id is null then
    raise exception using errcode = '42501', message = 'authentication_required';
  end if;
  if v_organization_id is null then
    raise exception using errcode = '42501', message = 'active_organization_required';
  end if;
  if not public.has_organization_role(
    v_organization_id,
    array['organization_owner', 'organization_admin', 'teacher']::text[]
  ) then
    raise exception using errcode = '42501', message = 'assignment_recipient_forbidden';
  end if;

  insert into public.assignments (
    organization_id,
    curriculum_id,
    curriculum_version_id,
    title,
    description,
    assigned_by,
    publish_at,
    due_at,
    status
  ) values (
    v_organization_id,
    p_curriculum_id,
    p_curriculum_version_id,
    p_title,
    nullif(p_description, ''),
    v_actor_id,
    p_publish_at,
    p_due_at,
    'scheduled'
  ) returning id into v_assignment_id;

  perform public.persist_assignment_canonical_recipient_snapshot(
    v_assignment_id,
    p_class_ids,
    p_expected_class_student_ids,
    p_direct_student_ids,
    p_write_legacy_compatibility
  );

  insert into public.assignment_audit_events (
    organization_id,
    assignment_id,
    actor_id,
    action,
    metadata
  ) values (
    v_organization_id,
    v_assignment_id,
    v_actor_id,
    'ASSIGNMENT_CREATED',
    jsonb_build_object(
      'curriculumId', p_curriculum_id,
      'curriculumVersionId', p_curriculum_version_id,
      'source', 'le001_phase5e'
    )
  );

  return v_assignment_id;
end;
$$;

revoke all on function public.create_assignment_with_canonical_recipients(
  uuid, uuid, text, text, timestamptz, timestamptz,
  uuid[], uuid[], uuid[], boolean
) from public, anon, service_role;
grant execute on function public.create_assignment_with_canonical_recipients(
  uuid, uuid, text, text, timestamptz, timestamptz,
  uuid[], uuid[], uuid[], boolean
) to authenticated;

create or replace function public.add_assignment_canonical_recipients(
  p_assignment_id uuid,
  p_class_ids uuid[],
  p_expected_class_student_ids uuid[],
  p_direct_student_ids uuid[],
  p_write_legacy_compatibility boolean
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  return public.persist_assignment_canonical_recipient_snapshot(
    p_assignment_id,
    p_class_ids,
    p_expected_class_student_ids,
    p_direct_student_ids,
    p_write_legacy_compatibility
  );
end;
$$;

revoke all on function public.add_assignment_canonical_recipients(
  uuid, uuid[], uuid[], uuid[], boolean
) from public, anon, service_role;
grant execute on function public.add_assignment_canonical_recipients(
  uuid, uuid[], uuid[], uuid[], boolean
) to authenticated;

create or replace function public.get_assignment_recipient_projection(
  p_assignment_id uuid
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
  v_actor_id uuid := auth.uid();
  v_organization_id uuid := public.get_active_organization_id();
begin
  if v_actor_id is null then
    raise exception using errcode = '42501', message = 'authentication_required';
  end if;
  if v_organization_id is null then
    raise exception using errcode = '42501', message = 'active_organization_required';
  end if;
  if not exists (
    select 1
    from public.assignments as assignment
    where assignment.id = p_assignment_id
      and assignment.organization_id = v_organization_id
      and (
        public.has_organization_role(
          v_organization_id,
          array['organization_owner', 'organization_admin']::text[]
        )
        or assignment.assigned_by = v_actor_id
      )
  ) then
    raise exception using errcode = 'P0002', message = 'assignment_not_found';
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
    where recipient.assignment_id = p_assignment_id
      and recipient.organization_id = v_organization_id
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
    where legacy.assignment_id = p_assignment_id
      and legacy.organization_id = v_organization_id
      and not exists (
        select 1
        from public.assignment_recipient_legacy_compatibility as compatibility
        where compatibility.assignment_id = legacy.assignment_id
          and compatibility.organization_id = legacy.organization_id
          and compatibility.legacy_student_id = legacy.student_id
      )
  ) as projection
  order by projection.assigned_at, projection.recipient_id nulls last;
end;
$$;

revoke all on function public.get_assignment_recipient_projection(uuid)
from public, anon, service_role;
grant execute on function public.get_assignment_recipient_projection(uuid)
to authenticated;
