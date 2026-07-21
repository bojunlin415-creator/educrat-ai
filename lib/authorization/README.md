# Authorization Runtime Core

AP-004A established the framework-neutral contracts. AP-004B adds pure,
deterministic permission, scope, condition, policy, and decision evaluation.

```text
shared
  ↑
domain
  ↑
interfaces
  ↑
application
```

Rules:

- `domain` may depend only on `domain` and `shared`.
- `interfaces` may depend only on `interfaces`, `domain`, and `shared`.
- `application` may depend on `application`, `interfaces`, `domain`, and `shared`.
- No layer imports React, Next.js routes, UI components, Supabase, OAuth, JWT, middleware, Curriculum, or other feature services.
- `DefaultAuthorizationProvider` still only creates an immutable `AuthorizationContext`.
- `AuthorizationEngine` coordinates the default Permission and Policy resolver implementations without querying external data.
- `PermissionKey` remains an exact approved-shape key. Wildcards exist only as a distinct runtime `PermissionExpression` and do not change the 224-key catalog.
- Default deny, exact context grants, active tenant Membership, scope compatibility, safe conditions, and DENY override are enforced by the pure runtime.
- Catalog membership/version, trusted context adapters, API/middleware/UI guards, Audit persistence, Database, Supabase, RLS, Session, JWT, and OAuth remain outside this module.
