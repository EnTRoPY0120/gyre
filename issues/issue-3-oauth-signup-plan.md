# Issue #3: Add OAuth Sign-up via External Providers - Implementation Plan

## Context

Gyre already has extensive OAuth infrastructure (providers, factory, callback, auto-provisioning in `sso.ts`), but it has a **critical bug**: OAuth routes (`/api/auth/[providerId]/login` and `/api/auth/[providerId]/callback`) are not in the public routes list in `hooks.server.ts`, so unauthenticated users cannot use OAuth at all. Additionally, the login page treats OAuth as secondary to local login, there's no app settings system for auth controls, and no Helm-based provider seeding.

## Implementation Plan

### Step 1: Fix OAuth Route Authentication Bug

**File:** `src/hooks.server.ts`

The `PUBLIC_ROUTES` array has `/api/auth/login` and `/api/auth/logout` but OAuth routes like `/api/auth/github/login` don't match. Replace the two individual entries with a single `/api/auth` prefix to make all auth API routes public. This is safe since all auth endpoints validate their own parameters internally.

### Step 2: App Settings Table + Schema

**Files:** `src/lib/server/db/schema.ts`, `src/lib/server/db/migrate.ts`

Add `appSettings` table (key-value store):

```sql
CREATE TABLE IF NOT EXISTS app_settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at INTEGER NOT NULL DEFAULT (unixepoch())
)
```

Add Drizzle schema definition and type exports (`AppSetting`, `NewAppSetting`).

### Step 3: Settings Service Module

**New file:** `src/lib/server/settings.ts`

Key-value settings service with:

- Settings keys: `auth.localLoginEnabled`, `auth.allowSignup`, `auth.domainAllowlist`
- Defaults: `true`, `true`, `[]`
- Environment variable overrides: `GYRE_AUTH_LOCAL_LOGIN_ENABLED`, `GYRE_AUTH_ALLOW_SIGNUP`, `GYRE_AUTH_DOMAIN_ALLOWLIST` (env vars take precedence over DB values)
- In-memory cache with 30s TTL
- Functions: `getSetting()`, `setSetting()`, `getAuthSettings()`, convenience getters
- `seedAuthSettings()` - writes env var values into DB as baseline (only if key doesn't exist)

### Step 4: Settings API Endpoints

**New file:** `src/routes/api/admin/settings/+server.ts`

- `GET /api/admin/settings` - Returns all auth settings (admin only)
- `PATCH /api/admin/settings` - Updates settings (admin only)
- Follow existing admin API patterns from `src/routes/api/admin/auth-providers/+server.ts`

### Step 5: Domain Allowlist + Signup Control Enforcement

**File:** `src/lib/server/auth/sso.ts`

Modify `createOrUpdateSSOUser()`:

- Import and check `getAuthSettings()`
- For **new users only** (no existing link):
  - Check `allowSignup` setting - if false, return `{ user: null, reason: 'signup_disabled' }`
  - Check domain allowlist - if non-empty and email domain not in list, return `{ user: null, reason: 'domain_not_allowed' }`
- Change return type to `{ user: User | null; reason?: string }` for better error messages
- Existing users (already linked) always allowed to log in regardless of settings

**File:** `src/routes/api/auth/[providerId]/callback/+server.ts`

Update to handle the new return type with specific error messages per reason:

- `signup_disabled`: "New account registration is not available. Contact your administrator."
- `domain_not_allowed`: "Your email domain is not authorized for this application."
- `auto_provision_disabled`: "Account auto-provisioning is disabled. Contact your administrator."

### Step 6: OAuth-First Login Page Redesign

**File:** `src/routes/login/+page.svelte`

New layout when providers exist:

1. Logo header
2. **OAuth provider buttons** (primary, full-width, larger `py-4`)
3. **Divider**: "Or sign in with local account"
4. **Local login form** (username/password)

When no providers configured OR `localLoginEnabled=false`:

- No providers + local enabled → Show only local login (current behavior)
- Providers + local disabled → Show only OAuth buttons
- No providers + local disabled → Error message: "No authentication methods configured"

**File:** `src/routes/login/+page.server.ts`

Update load function to also return `localLoginEnabled` from `getAuthSettings()`.

### Step 7: Admin Settings Page

**New files:** `src/routes/admin/settings/+page.svelte`, `src/routes/admin/settings/+page.server.ts`

Admin settings page following existing admin page patterns:

- **Local Login** toggle (on/off switch)
- **Allow OAuth Signup** toggle
- **Domain Allowlist** textarea (comma-separated domains like `example.com, company.org`)
- Visual indicator when setting is overridden by env var (disabled toggle + tooltip)
- Same dark theme, same admin auth checks

### Step 8: Sidebar Navigation Update

**File:** `src/lib/components/layout/AppSidebar.svelte`

Add "Settings" link in the Admin section (between "Auth Providers" and "Policies"), using a `settings` icon.

### Step 9: Helm Provider Seeding

**New file:** `src/lib/server/auth/seed-providers.ts`

`seedAuthProviders()` function:

- Reads `GYRE_AUTH_PROVIDERS` env var (JSON array)
- For each provider: check if same `name` exists in DB
  - Not exists → create (encrypt client secret, generate ID)
  - Exists → skip (don't overwrite admin UI changes)
- Override client secret from `GYRE_AUTH_PROVIDER_{index}_CLIENT_SECRET` env vars if set
- Returns `{ created: number, skipped: number }`

**File:** `src/lib/server/initialize.ts`

Add auth settings + provider seeding step after RBAC initialization:

```
🔑 Setting up authentication settings...
   ✓ Seeded 2 auth provider(s)
   ✓ Authentication settings ready
```

### Step 10: Helm Chart Updates

**File:** `charts/gyre/values.yaml`

Add `auth` section:

```yaml
auth:
  localLoginEnabled: true
  allowSignup: true
  domainAllowlist: []
  providers: []
  providersExistingSecret: ''
```

With commented examples for GitHub, Google, OIDC providers.

**File:** `charts/gyre/templates/deployment.yaml`

Add env vars from `auth` values:

- `GYRE_AUTH_LOCAL_LOGIN_ENABLED`
- `GYRE_AUTH_ALLOW_SIGNUP`
- `GYRE_AUTH_DOMAIN_ALLOWLIST`
- `GYRE_AUTH_PROVIDERS` (JSON-encoded providers array)
- Per-provider client secrets from `providersExistingSecret`

## Files Summary

| Action | File                                                   |
| ------ | ------------------------------------------------------ |
| Edit   | `src/hooks.server.ts`                                  |
| Edit   | `src/lib/server/db/schema.ts`                          |
| Edit   | `src/lib/server/db/migrate.ts`                         |
| Create | `src/lib/server/settings.ts`                           |
| Create | `src/routes/api/admin/settings/+server.ts`             |
| Edit   | `src/lib/server/auth/sso.ts`                           |
| Edit   | `src/routes/api/auth/[providerId]/callback/+server.ts` |
| Edit   | `src/routes/login/+page.svelte`                        |
| Edit   | `src/routes/login/+page.server.ts`                     |
| Create | `src/routes/admin/settings/+page.svelte`               |
| Create | `src/routes/admin/settings/+page.server.ts`            |
| Edit   | `src/lib/components/layout/AppSidebar.svelte`          |
| Create | `src/lib/server/auth/seed-providers.ts`                |
| Edit   | `src/lib/server/initialize.ts`                         |
| Edit   | `charts/gyre/values.yaml`                              |
| Edit   | `charts/gyre/templates/deployment.yaml`                |

## Verification

1. `bun run check` - TypeScript type checking passes
2. `bun run lint` - No lint errors
3. `bun run build` - Production build succeeds
4. Manual verification:
   - Login page shows OAuth buttons above local login when providers configured
   - Login page shows only local login when no providers configured
   - OAuth flow works for unauthenticated users (route bug fixed)
   - Admin settings page accessible and functional
   - Settings changes take effect (local login toggle, signup toggle, domain allowlist)
   - Helm values template renders correctly: `helm template gyre charts/gyre --set auth.localLoginEnabled=false`
