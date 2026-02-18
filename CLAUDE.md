# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Gyre is a modern, full-featured WebUI for FluxCD built with SvelteKit and Bun. It provides real-time monitoring, multi-cluster management, built-in RBAC, and comprehensive FluxCD resource management.

**Deployment**: In-cluster only deployment via Helm chart. Runs as a standard Node.js application in Kubernetes with ServiceAccount authentication. Includes production-ready Helm chart, Docker image (published to ghcr.io/entropy0120/gyre), and GitHub Actions CI/CD pipeline.

**Current Status**: Core functionality complete with dashboard, all FluxCD resources, real-time updates, multi-cluster support, authentication/RBAC, Monaco Editor integration, and comprehensive resource templates with complete FluxCD CRD field coverage.

## Common Commands

### Development

**DevContainer (Recommended):**

The easiest way to start developing is using the provided devcontainer:

1. Open repository in VS Code with Dev Containers extension
2. Press `F1` → "Dev Containers: Reopen in Container"
3. Devcontainer automatically installs Bun, VS Code extensions, mounts `~/.kube`, and runs setup
4. Optional: Create local kind cluster with FluxCD for testing

```sh
# Inside devcontainer, start development server
bun run dev

# Optional: Create test cluster
kind create cluster
flux install
```

**Manual Development:**

```sh
bun install              # Install dependencies
bun run dev             # Start development server
bun run dev --open      # Start dev server and open in browser
```

### Code Quality

```sh
bun run check           # Type-check with svelte-check
bun run check:watch     # Type-check in watch mode
bun run lint            # Run prettier and eslint
bun run format          # Format code with prettier
```

### Building & Testing

```sh
bun run build           # Build SvelteKit application
bun run preview         # Preview production build locally

# Docker build
docker build -t gyre:local .
docker run -p 3000:3000 -v $(pwd)/data:/data gyre:local
```

### Production Deployment (Helm Chart)

```sh
# Build Docker image
docker build -t gyre:latest .

# Install with Helm
helm install gyre charts/gyre --namespace flux-system --create-namespace

# Get admin password
kubectl get secret gyre-initial-admin-secret -n flux-system -o jsonpath='{.data.password}' | base64 -d

# Access via port-forward
kubectl port-forward -n flux-system svc/gyre 3000:80
```

**Architecture**: In-cluster only deployment with ServiceAccount authentication. All Kubernetes API access uses the pod's ServiceAccount credentials.

### Database Management

```sh
bun drizzle-kit generate    # Generate migrations from schema changes
bun drizzle-kit migrate     # Run migrations (production runs auto on startup)
bun drizzle-kit studio      # Open database browser UI
```

**Database Location**: `./data/gyre.db` (development), `/data/gyre.db` (production container)

### Documentation Site

The project includes a Docusaurus documentation site at `entropy0120.github.io/gyre/`:

```sh
# Navigate to documentation folder
cd documentation

# Install dependencies (uses npm, not bun)
npm install

# Start documentation dev server
npm run start

# Build documentation
npm run build

# Serve built docs locally
npm run serve
```

**Important**: The documentation folder uses npm/package-lock.json (Docusaurus requirement), while the main app uses Bun. They don't interfere with each other. Documentation auto-deploys to GitHub Pages via `.github/workflows/docs-deploy.yml` on push to main.

### Release & Deployment

**Creating a Release:**

```sh
# 1. Update versions in package.json and charts/gyre/Chart.yaml
# 2. Commit changes
git add package.json charts/gyre/Chart.yaml
git commit -m "chore: bump version to v0.2.0"
git push origin main

# 3. Create and push tag (triggers automated release workflow)
git tag -a v0.2.0 -m "Release v0.2.0: Description of changes"
git push origin v0.2.0

# GitHub Actions automatically:
# - Builds multi-arch Docker images (amd64, arm64)
# - Publishes to ghcr.io/entropy0120/gyre
# - Packages and attaches Helm chart
# - Creates GitHub Release with notes
```

**Workflow Files:**

- `.github/workflows/build.yml` - CI build on every push
- `.github/workflows/release.yml` - Release automation on tags

**Branch Naming Convention:**

Branch names follow the pattern `<type>/<short-description>`:
```
feat/add-oci-repository-support
fix/session-timeout-issue
docs/update-install-guide
refactor/flux-api-endpoints
chore/update-dependencies
ci/add-multi-arch-build
```

**Commit Message Convention:**

The project follows conventional commits format:
```
<type>(<scope>): <description>

[optional body]

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>
```

Common types: `feat`, `fix`, `docs`, `chore`, `ci`, `refactor`, `test`, `style`, `perf`
Common scopes: `templates`, `wizard`, `auth`, `ui`, `api`, `server`, `db`, `k8s`, `flux`, `helm`, `editor`

Examples:
- `feat(wizard): add YAML error handling and field help tooltips`
- `fix(templates): enforce type-specific URL validation for HelmRepository`
- `docs: update README and add screenshots section to homepage`
- `feat(editor): integrate Monaco Editor for enhanced code editing`

## Architecture

Gyre follows a standard SvelteKit architecture with a unique deployment model:

### Stack

- **Runtime**: Bun for development, Node.js/Bun for production
- **Framework**: SvelteKit with adapter-node
- **Styling**: TailwindCSS v4 (configured via Vite plugin) with shadcn-svelte components
- **Language**: TypeScript (strict mode enabled)
- **Database**: SQLite with Drizzle ORM (file-based at `/data/gyre.db` in container)
- **Kubernetes**: @kubernetes/client-node for K8s API integration
- **Code Editor**: Monaco Editor (VS Code's editor) for YAML/JSON editing

### Key Architectural Points

1. **Deployment Model**: In-cluster only deployment using Helm chart. Runs in Kubernetes pods with ServiceAccount authentication. Uses SvelteKit's adapter-node for standard Node.js runtime with embedded SQLite database mounted on PersistentVolume (`/data`). Docker image published to ghcr.io via GitHub Actions.

2. **Server-Side Architecture**: FluxCD/Kubernetes integration via SvelteKit API routes + server modules:
   - `src/lib/server/kubernetes/` - K8s client and Flux resource utilities
   - `src/lib/server/db/` - Drizzle ORM with SQLite schema for users, sessions, RBAC, audit logs
   - `src/lib/server/auth.ts` - Authentication and session management
   - `src/lib/server/rbac.ts` - Role-based access control enforcement
   - `src/lib/server/clusters.ts` - Multi-cluster configuration management
   - `src/routes/api/` - REST API endpoints for Flux resources and actions

3. **SvelteKit File Structure**:
   - `src/routes/+page.svelte` - Dashboard overview with resource summaries
   - `src/routes/+layout.svelte` - Main layout with sidebar navigation
   - `src/routes/resources/[type]/+page.svelte` - Resource list pages
   - `src/routes/resources/[type]/[namespace]/[name]/+page.svelte` - Resource detail views
   - `src/routes/admin/` - Admin pages (users, clusters, policies)
   - `src/routes/api/` - API routes for Kubernetes operations
   - `src/lib/components/` - Reusable UI components (flux/, layout/, ui/)

4. **Svelte 5 Runes**: Uses modern runes API (`$state()`, `$derived()`, `$props()`, `$effect()`) instead of legacy reactive syntax. All stores use `.svelte.ts` runes-based state.

5. **TailwindCSS v4**: Modern Vite plugin configuration with custom zinc/gold theme. Uses shadcn-svelte components with bits-ui primitives.

6. **Authentication & RBAC**: Full authentication system with:
   - SQLite database (Drizzle ORM) for users, sessions, and RBAC policies
   - Admin password stored in Kubernetes Secret (auto-generated by Helm chart)
   - bcrypt password hashing
   - Secure cookie-based session management
   - Three roles: admin, editor, viewer
   - Fine-grained permissions per resource type, namespace, and cluster
   - Audit logging for all actions

7. **Kubernetes Access**: In-cluster only configuration:
   - Uses pod ServiceAccount for authentication
   - ClusterRole with permissions for all FluxCD resources
   - Access to core Kubernetes resources (namespaces, events, pods, etc.)
   - Runs in `flux-system` namespace by default

8. **Real-time Updates**: WebSocket server for live resource updates using Kubernetes Watch API (`src/routes/api/ws/`).

9. **Caching Strategy**: Multi-layer caching to reduce K8s API calls:
   - Server-side in-memory cache with 30s TTL for dashboard
   - 15s TTL for individual API responses
   - WebSocket invalidation for changed resources

10. **Environment Configuration**: In-cluster only - no support for local kubeconfig:
    - Detects in-cluster via `KUBERNETES_SERVICE_HOST` environment variable
    - Uses `/var/run/secrets/kubernetes.io/serviceaccount/` for auth
    - Falls back gracefully with error messages for local development
    - Admin password read from `ADMIN_PASSWORD` env var or auto-generated secret

## Development Patterns

### Accessibility & Mobile Responsiveness

The project maintains WCAG 2.1 accessibility standards and mobile-first responsive design:

**Accessibility Requirements:**
- All icon-only buttons/links must have `aria-label` attributes
- Keyboard navigation for all interactive elements
- Semantic HTML and ARIA attributes for screen readers
- WCAG AA color contrast compliance (zinc/gold theme)

**Mobile Responsiveness:**
- Uses Tailwind breakpoints (sm:, md:, lg:, xl:)
- Collapsible sidebar on mobile with hamburger menu
- Touch-friendly targets (min 44x44px)
- Responsive table layouts via ResourceTable component
- Optimized AppHeader and AppSidebar for mobile

### TypeScript Configuration

- Extends `.svelte-kit/tsconfig.json` (auto-generated by SvelteKit)
- Strict mode enabled
- Path alias `$lib` maps to `src/lib/`
- Module resolution set to "bundler"
- All FluxCD resource types defined in `src/lib/server/kubernetes/flux/types.ts`

### Adding New FluxCD Resources

When adding support for a new FluxCD resource type:

1. **Define types** in `src/lib/server/kubernetes/flux/types.ts`
2. **Add resource utilities** in `src/lib/server/kubernetes/flux/resources.ts`
3. **Create API routes** in `src/routes/api/flux/[resourceType]/`
4. **Add UI components** in `src/lib/components/flux/resources/`
5. **Update navigation** in `src/routes/+layout.svelte`
6. **Add resource template** in `src/lib/templates/index.ts` (see Resource Templates section below)

### Resource Templates & Wizard System

The project includes a comprehensive resource creation wizard system (`src/lib/components/wizards/ResourceWizard.svelte`) with templates for all 13 FluxCD resource types defined in `src/lib/templates/index.ts`.

#### Template Architecture

The system is built on three core interfaces:

1.  **`ResourceTemplate`**: Defines the top-level resource metadata (kind, group, plural, initial YAML) and its fields.
2.  **`TemplateField`**: Represents an individual form field. Supports types: `string`, `number`, `boolean`, `select`, `duration`, `textarea`, `array`, and `object`.
3.  **`TemplateSection`**: Used to group fields into logical, optionally collapsible, UI sections.

#### Key Developer Features

*   **Conditional Visibility (`showIf`)**: Fields can be shown or hidden based on the value of another field.
    ```typescript
    showIf: { field: 'refType', value: 'branch' }
    ```
*   **Validation**: Supports required fields, regex patterns, and range validation (min/max).
*   **Duration Validation**: `duration` fields use a specific pattern: `^([0-9]+(\\.[0-9]+)?(s|m|h))+$`.
*   **Resource Autocomplete**: Use `referenceType` or `referenceTypeField` to enable resource lookup in the wizard.
*   **Bidirectional Sync**: The `ResourceWizard` component manages the synchronization between the form state (`formValues`) and the raw YAML manifest using the `yaml` library's `parseDocument` and `setIn` methods to preserve comments.

#### Adding a New Resource Type

1.  **Define the Template**: Create a new `ResourceTemplate` object in `src/lib/templates/index.ts`.
2.  **Organize Sections**: Define logical sections for better UX (e.g., 'Source', 'Authentication').
3.  **Configure Fields**:
    *   Set `path` to the target location in the YAML manifest.
    *   Provide `helpText` and `docsUrl` for all non-obvious fields.
    *   Add validation patterns for identifiers and durations.
4.  **Register Template**: Add your template to the `RESOURCE_TEMPLATES` array export.
5.  **Verify UI**: Test the new template in the browser to ensure `showIf` logic and validation work as expected.

#### Component Structure

*   `ResourceWizard.svelte`: Main orchestration component. Handles mode switching and YAML sync.
*   `ArrayField.svelte`: Manages dynamic lists of primitive or object types.
*   `ReferenceField.svelte`: Provides an autocomplete search for existing Kubernetes resources.
*   `FieldHelp.svelte`: Renders help tooltips with external documentation links.

### Monaco Editor Integration

The project uses Monaco Editor (VS Code's editor) for YAML/JSON editing throughout the application.

**Components:**
- `src/lib/components/editors/MonacoEditor.svelte` - Main Monaco wrapper component
- `src/lib/components/editors/YamlEditor.svelte` - Legacy simple editor (kept for fallback)

**Monaco Editor Features:**
- Syntax highlighting for YAML and JSON
- Real-time validation with error markers
- Bidirectional value binding with `$bindable()`
- Theme synchronization with app theme (dark/light mode)
- Configurable options: readonly, minimap, line numbers, height
- Graceful fallback to textarea if Monaco fails to load
- Loading state with textarea shown during initialization

**Usage Pattern:**
```svelte
<script>
  import MonacoEditor from '$lib/components/editors/MonacoEditor.svelte';

  let yaml = $state('apiVersion: v1\nkind: Pod');
  let errors = $state<Monaco.editor.IMarker[]>([]);
</script>

<MonacoEditor
  bind:value={yaml}
  language="yaml"
  height="500px"
  onValidation={(markers) => errors = markers}
/>
```

**Important Implementation Details:**
- Monaco is lazy-loaded using dynamic import (`import('monaco-editor')`)
- Editor instance cleanup via `onDestroy` to prevent memory leaks
- Theme applied through `monaco.editor.setTheme()` with custom token colors
- Validation markers monitored via `onDidChangeMarkers` event
- Uses `$effect()` rune to sync external value changes to editor

**When to use MonacoEditor vs YamlEditor:**
- Use `MonacoEditor` for resource creation/editing (wizard YAML mode, resource detail pages)
- Use basic `textarea` or `YamlEditor` for simple single-field inputs
- MonacoEditor automatically falls back to textarea if loading fails

### Database Schema Changes

When modifying the database schema:

1. Edit `src/lib/server/db/schema.ts`
2. Run `bun drizzle-kit generate` to create migration
3. Migrations auto-apply on app startup via `src/lib/server/db/migrate.ts`
4. Test with `bun drizzle-kit studio` locally

**Database Schema:**

- `users` - User accounts (local and SSO)
- `sessions` - Active user sessions
- `audit_logs` - Audit trail for all actions
- `clusters` - Multi-cluster configuration
- `cluster_contexts` - Cluster kubeconfig contexts
- `rbac_policies` - Role-based access control policies
- `rbac_bindings` - User-to-policy assignments
- `auth_providers` - SSO/OIDC provider configurations
- `user_providers` - User-to-provider links

**Note**: The custom dashboards feature (`dashboards` and `dashboard_widgets` tables) was removed in favor of a simpler single-dashboard approach. Legacy tables may exist in older database migrations but are no longer used.

### SSO/OAuth Integration

The project includes full SSO support via Arctic and OIDC:

- **Providers supported**: GitHub, Google, Generic OIDC
- **Configuration**: Admin UI for provider setup (no restart required)
- **User flow**: Login → OAuth redirect → Callback → Auto-provision user
- **Location**: `src/lib/server/auth/oauth/` and `src/routes/auth/`

**Adding a new OAuth provider:**

1. Create provider class in `src/lib/server/auth/oauth/providers/`
2. Extend `OAuthProviderBase` and implement required methods
3. Register in `src/lib/server/auth/oauth/factory.ts`
4. Add UI configuration in admin panel

### Vite Configuration

- **Manual chunking** for optimal bundle size (vendor, monaco-editor, vendor-icons, vendor-db)
- **Monaco Editor optimization**: Separate chunk for monaco-editor (~3MB) to avoid bloating main bundle
- **TailwindCSS v4** via `@tailwindcss/vite` plugin (not PostCSS)
- **optimizeDeps.include**: Monaco Editor pre-bundled for faster dev startup
- Report compressed size on build

### WebSocket/SSE Notification System

The real-time notification system uses Server-Sent Events (SSE, not WebSocket despite file naming) located in `src/routes/api/ws/events/+server.ts` with client store at `src/lib/stores/websocket.svelte.ts`.

**Architecture:**
- Polls Kubernetes API every 5 seconds (can't use Watch API due to connection limits)
- Global state tracking prevents duplicate notifications across client reconnections
- Both client and server implement deduplication layers

**Deduplication Strategy:**
- Track notification state: `{revision, readyStatus, readyReason, messagePreview}`
- Only trigger on meaningful changes:
  - ✅ Revision/SHA actually changed (new deployment)
  - ✅ Ready status changed to False (failure)
  - ✅ Recovered from False to True with new revision (fixed)
  - ❌ Transient "Unknown" states during reconciliation (skipped)
  - ❌ Ready status changes when revision unchanged (skipped)
- 30s settling period for ADDED events to avoid initial sync spam
- State persists in localStorage: `gyre_notifications` and `gyre_notification_state`

**Important Notes:**
- FluxCD resources reconcile frequently (every 1-10 minutes based on `.spec.interval`)
- Most changes are metadata-only (resourceVersion, timestamps)
- Must match notification state structure between server and client
- Revision/SHA is primary indicator of actual resource changes
- Always persist state to localStorage to survive page refreshes

## FluxCD Resources (ALL IMPLEMENTED)

All FluxCD Custom Resource Definitions are fully supported with list/detail views and actions:

### Source Controller Resources

- **GitRepositories** - Git repository sources
- **HelmRepositories** - Helm chart repositories
- **HelmCharts** - Helm charts from repositories
- **Buckets** - S3-compatible bucket sources
- **ExternalArtifacts** - External artifact sources

### Kustomize Controller Resources

- **Kustomization** - Kustomize overlays and deployments

### Helm Controller Resources

- **HelmReleases** - Helm release deployments

### Notification Controller Resources

- **Alerts** - Alert definitions for events
- **Providers** - Notification providers (Slack, Discord, etc.)
- **Receivers** - Webhook receivers for external events

### Image Automation Resources

- **ImageRepositories** - Container image repositories to scan
- **ImagePolicies** - Policies for selecting image versions
- **ImageUpdateAutomation** - Automated image updates to Git

## Important Notes

### Testing

**No automated tests currently**: The project does not have a test suite. When making changes:

- Manually test all affected functionality
- Test both success and error paths
- Verify in a real Kubernetes cluster with FluxCD installed
- Check browser console for client-side errors
- Review server logs for backend issues

**Testing Resources:**

- `TESTING_PLAN_v0.1.0.md` - Comprehensive manual test plan covering all features
- `TESTING_REPORT_v0.1.0.md` - Latest testing report with results
- `MANUAL_TESTING_RESULTS.md` - Resource wizard testing results (37/37 tests passing)

**Local Testing with Kind:**

```sh
# Create test cluster
kind create cluster --name gyre-test

# Install FluxCD
flux install

# Build and load image into kind
docker build -t gyre:test .
kind load docker-image gyre:test --name gyre-test

# Install via Helm
helm install gyre charts/gyre -n flux-system \
  --set image.tag=test \
  --set image.pullPolicy=Never

# Port forward to test
kubectl port-forward -n flux-system svc/gyre 9999:80
```

### Common Development Gotchas

1. **Server vs Client Code**: `$lib/server/` code ONLY runs server-side. Never import from there in `.svelte` component `<script>` tags - use SvelteKit load functions instead.

2. **Svelte 5 Runes**: This project uses Svelte 5 with runes (`$state`, `$derived`, `$effect`, `$props`). Do NOT use legacy Svelte syntax like `let count = $state(0)` should be used instead of `let count = 0; $: doubled = count * 2`.

3. **Database Migrations**: Schema changes require migration files. Don't manually edit the database or skip migrations - always use `drizzle-kit generate`.

4. **Docker Multi-stage Build**: Development uses Bun, production container uses Node.js. The Dockerfile has separate builder (Bun + Node) and runtime (Node only) stages.

5. **ServiceAccount Permissions**: If you add new Kubernetes resource types, update the ClusterRole in `charts/gyre/templates/rbac.yaml`.

6. **Inventory System**: The inventory architecture (`src/lib/server/kubernetes/flux/inventory.ts`) builds hierarchical resource trees showing relationships between Flux resources and their downstream Kubernetes objects. When adding new resource types, consider if they should participate in the inventory tree.

7. **WebSocket Updates**: The real-time update system (`src/routes/api/ws/`) uses Server-Sent Events with polling (not Watch API). When adding new resource types, add corresponding watch handlers to enable live updates. See WebSocket/SSE Notification System section for deduplication details.

8. **LocalStorage Usage**: The project uses browser localStorage for:
   - Notification state persistence (`gyre_notifications`, `gyre_notification_state`)
   - Resource wizard form values (template-specific keys like `gyre-wizard-{template.id}`)
   - Always check `typeof window !== 'undefined'` before accessing localStorage in `.svelte.ts` files

9. **Documentation Folder**: The `/documentation` folder is a separate Docusaurus project that uses npm/package-lock.json (not Bun). Don't accidentally use Bun commands there or try to unify the package managers - Docusaurus requires npm.

10. **Monaco Editor Lazy Loading**: Monaco Editor is always loaded via dynamic import: `import('monaco-editor')`. Never use static imports in component `<script>` tags. The editor initializes in `onMount()` and must be cleaned up in component destroy lifecycle. Always check `browser` environment before initializing.

### Known Limitations

- **In-cluster only**: Cannot run locally with kubeconfig (by design)
- **Single database file**: SQLite at `/data/gyre.db` - not suitable for horizontal scaling
- **WebSocket limitations**: Watch API may miss events during reconnection
- **No automated backups**: Database backup is user's responsibility via PV snapshots

### Troubleshooting

**Dashboard stuck on "Initializing...":**

- Check `/api/flux/health` endpoint includes `availableContexts` field
- Verify pod logs for errors connecting to Kubernetes API
- Ensure ServiceAccount has correct permissions

**Health probes failing:**

- Verify `/api/flux/health` endpoint is publicly accessible (no auth required)
- Check probe configuration in `charts/gyre/templates/deployment.yaml`
- Review pod logs for startup errors

**Database errors on startup:**

- Check PersistentVolume is mounted at `/data`
- Verify directory permissions allow writing
- Review migration logs in pod output

**Authentication issues:**

- Verify admin password in `gyre-initial-admin-secret` secret
- Check session cookie is being set (browser dev tools)
- Review database for user records: `kubectl exec -n flux-system <pod> -- ls -la /data/gyre.db`
