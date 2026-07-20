# Authorization Runtime Foundation

AP-004A establishes framework-neutral TypeScript contracts only.

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
- `DefaultAuthorizationProvider` only creates an immutable `AuthorizationContext`. It never calls a resolver or decides `ALLOW`／`DENY`.
- `PermissionResolver` and `PolicyResolver` have no implementation in AP-004A.
- `PermissionKey` validates only the approved `resource.action` shape. Catalog membership remains outside this package.
