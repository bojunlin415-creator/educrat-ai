# Authorization Runtime Core

AP-004A established the framework-neutral contracts. AP-004B adds pure,
deterministic permission, scope, condition, policy, and decision evaluation.
AP-004C-A adds the minimal application adapter. AP-004C-B replaces its initial
caller-supplied context boundary with provider-issued trusted context, without
connecting product routes, framework state, persistence, or enforcement.

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
- `DefaultAuthorizationContextProvider` coordinates interface-only Identity, Membership, Persona, Role, and Permission Grant authorities.
- `DefaultAuthorizationProvider` delegates immutable context creation to the trusted provider and factory boundary.
- `AuthorizationEngine` coordinates the default Permission and Policy resolver implementations without querying external data.
- `authorize()` is the canonical application entry to that engine; application adapters do not call the engine directly.
- `AuthorizationContextFactory` only accepts a provider-issued envelope; it does not read Session, Cookie, Database, or Supabase.
- `AuthorizeRequest` cannot carry context. `authorize()` requires an `AuthorizationContextProvider` supplied by a trusted composition root.
- `authorizeServerAction()` and `authorizeApiRequest()` are framework-neutral helpers, not actual Server Actions or Route Handlers.
- `PermissionKey` remains an exact approved-shape key. Wildcards exist only as a distinct runtime `PermissionExpression` and do not change the 224-key catalog.
- Default deny, exact context grants, active tenant Membership, scope compatibility, safe conditions, and DENY override are enforced by the pure runtime.
- Concrete authority adapters, Catalog persistence, API/middleware/UI guards, Audit persistence, Database, Supabase, RLS, Session, JWT, and OAuth remain outside this module.
