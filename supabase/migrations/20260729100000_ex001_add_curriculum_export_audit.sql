-- EX-001 Curriculum Export Foundation
-- Additive audit action support for runtime-generated PDF exports.
-- Historical migrations remain unchanged.

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
    'CURRICULUM_AI_SAVED',
    'CURRICULUM_EXPORTED'
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
      'CURRICULUM_AI_SAVED',
      'CURRICULUM_EXPORTED'
    )
    and public.has_organization_role(
      organization_id,
      array['organization_owner', 'organization_admin', 'teacher']::text[]
    )
  )
);
