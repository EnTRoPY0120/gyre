# Plan: Implement GH Issue #308 — Security Hardening Follow-up

## Context

Follow-up to #266 (initial security fix). Four items identified during the security review of FluxCD templates that were out of scope initially due to complexity. This PR implements all four:

1. **Server-side spec validation** — CEL expressions, label maps, and substitution variables are currently validated client-side only; a determined attacker can bypass them.
2. **Resource limits fields** — No UI for CPU/memory limits on deployed workloads (HelmRelease via `spec.values.resources`).
3. **Timeout defaults** — Timeout fields have no default; resources can hang indefinitely without one.
4. **ValuesFrom cross-namespace warning** — `spec.valuesFrom` can reference resources from any namespace; users need a visible security warning.

---

## Branch

```
feat/308-security-hardening
```

---

## Item 1: Server-side spec validation

### New functions in `src/lib/server/validation.ts`

Add three validation helpers and one dispatcher:

```typescript
// Reuse/mirror the client-side CEL_VALIDATION pattern from templates/index.ts
export const CEL_PATTERN = /^[a-zA-Z0-9_.()[\]"' !&|=<>+\-*/%?:,\n\r\t ]{1,500}$/;

// Kubernetes label key: optional prefix/name, max 63 chars per segment
export const LABEL_KEY_PATTERN =
	/^([a-z0-9A-Z]([a-z0-9A-Z\-._]{0,61}[a-z0-9A-Z])?\/)?[a-zA-Z0-9]([a-zA-Z0-9\-._]{0,61}[a-zA-Z0-9])?$/;
// Kubernetes label value: empty OR alphanumeric start/end, hyphens/underscores/dots, max 63 chars
export const LABEL_VALUE_PATTERN = /^[a-zA-Z0-9]([a-zA-Z0-9\-._]{0,61}[a-zA-Z0-9])?$|^$/;
// Substitution variable: valid identifier (letter/underscore start, alphanumeric/underscore body)
export const SUBSTITUTE_VAR_PATTERN = /^[a-zA-Z_][a-zA-Z0-9_]*$/;

export function validateLabelMap(labels: unknown): string | null;
// Returns null if valid, error message string if invalid

export function validateSubstituteVars(vars: unknown): string | null;
// Validates keys match SUBSTITUTE_VAR_PATTERN, values are strings ≤ 1000 chars

export function validateFluxResourceSpec(
	resourceType: string,
	spec: Record<string, unknown>
): string | null;
// Dispatches to type-specific checks based on resourceType
```

**`validateFluxResourceSpec` type dispatch:**

- `Kustomization`:
  - `spec.healthCheckExprs[*].{inProgress, failed, current}` → validate each against `CEL_PATTERN`
  - `spec.commonMetadata.labels` → `validateLabelMap`
  - `spec.postBuild.substitute` → `validateSubstituteVars`
- `HelmRelease`:
  - `spec.commonMetadata.labels` → `validateLabelMap`
- All other types: no additional spec validation (return null)

### Call site — POST handler (`src/routes/api/v1/flux/[resourceType]/+server.ts`)

After apiVersion check (~line 273), before calling `createFluxResource`:

```typescript
import { validateK8sNamespace, validateFluxResourceSpec } from '$lib/server/validation';
// ...
const specError = validateFluxResourceSpec(resolvedType, body.spec);
if (specError) {
	throw error(422, { message: specError });
}
```

### Call site — PUT handler (`src/routes/api/v1/flux/[resourceType]/[namespace]/[name]/+server.ts`)

After apiVersion check, before calling `updateFluxResource`:

```typescript
import {
	validateK8sNamespace,
	validateK8sName,
	validateFluxResourceSpec
} from '$lib/server/validation';
// ...
const specError = validateFluxResourceSpec(
	resolvedType,
	(resource.spec ?? {}) as Record<string, unknown>
);
if (specError) {
	throw error(422, { message: specError });
}
```

### Tests — `src/tests/flux-security.test.ts`

Add a new `describe('server-side spec validation', ...)` block testing:

- Valid Kustomization CEL expressions pass
- CEL expressions with disallowed characters are rejected
- Valid label maps pass
- Label keys >63 chars are rejected
- Label values with disallowed chars are rejected
- Valid substitute variable names pass
- Substitute var names starting with a digit are rejected
- HelmRelease label map validation
- Unknown resource type returns null (no error)

---

## Item 2: Resource limits fields (HelmRelease)

### New section in `src/lib/templates/index.ts` — HelmRelease template

Add a `resourceLimits` section and four string fields. Fields write to `spec.values.resources.*` — synced bidirectionally by ResourceWizard's path-based update mechanism.

**Section:**

```typescript
{
  id: 'resourceLimits',
  title: 'Resource Limits',
  description: 'CPU and memory constraints for deployed workloads (standard Helm values pattern)',
  collapsible: true,
  defaultExpanded: false
}
```

**Fields** (add after `commonMetadataAnnotations` field):

```typescript
{
  name: 'resourceLimitsCpu',
  label: 'CPU Limit',
  path: 'spec.values.resources.limits.cpu',
  type: 'string',
  section: 'resourceLimits',
  placeholder: '500m',
  description: 'Maximum CPU for deployed pods (e.g. 500m, 1). Sets spec.values.resources.limits.cpu.',
  helpText: 'Most Helm charts expose resources.limits.cpu in their values. If your chart uses a different key, edit spec.values directly.'
},
{
  name: 'resourceLimitsMemory',
  label: 'Memory Limit',
  path: 'spec.values.resources.limits.memory',
  type: 'string',
  section: 'resourceLimits',
  placeholder: '128Mi',
  description: 'Maximum memory for deployed pods (e.g. 128Mi, 1Gi). Sets spec.values.resources.limits.memory.'
},
{
  name: 'resourceRequestsCpu',
  label: 'CPU Request',
  path: 'spec.values.resources.requests.cpu',
  type: 'string',
  section: 'resourceLimits',
  placeholder: '100m',
  description: 'Requested CPU for scheduling (e.g. 100m). Sets spec.values.resources.requests.cpu.'
},
{
  name: 'resourceRequestsMemory',
  label: 'Memory Request',
  path: 'spec.values.resources.requests.memory',
  type: 'string',
  section: 'resourceLimits',
  placeholder: '64Mi',
  description: 'Requested memory for scheduling (e.g. 64Mi). Sets spec.values.resources.requests.memory.'
}
```

---

## Item 3: Timeout defaults

### `src/lib/templates/index.ts` — add `default: '10m'` to all timeout fields

Add `default: '10m'` to each timeout field (type: `'duration'`, path: `spec.timeout`). Keep existing `placeholder` values unchanged.

Templates to update: GitRepository (~line 348), HelmChart (~line 657), Kustomization (~line 970), HelmRelease (~line 1537), Bucket (~line 2376), Provider (~line 2801). Also check OCIRepository and ImageUpdateAutomation.

---

## Item 4: ValuesFrom cross-namespace warning

### `src/lib/templates/index.ts` — update `valuesFrom` field in HelmRelease (~line 1437)

Update description and add helpText:

```typescript
description: 'References to ConfigMaps or Secrets containing Helm values.',
helpText: "Security: valuesFrom can reference resources from any namespace if the controller's RBAC permits it. Prefer referencing Secrets and ConfigMaps in the same namespace as the HelmRelease to limit exposure."
```

Add `namespace` sub-field to `arrayItemFields` (after `name`):

```typescript
{
  name: 'namespace',
  label: 'Namespace',
  path: 'namespace',
  type: 'string',
  placeholder: 'flux-system',
  description: 'Namespace of the referenced resource. Leave blank to use the HelmRelease namespace.'
}
```

---

## Critical files

| File                                                                  | Changes                                                                      |
| --------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| `src/lib/server/validation.ts`                                        | Add `validateLabelMap`, `validateSubstituteVars`, `validateFluxResourceSpec` |
| `src/routes/api/v1/flux/[resourceType]/+server.ts`                    | Call spec validation in POST handler                                         |
| `src/routes/api/v1/flux/[resourceType]/[namespace]/[name]/+server.ts` | Call spec validation in PUT handler                                          |
| `src/lib/templates/index.ts`                                          | Items 2, 3, 4                                                                |
| `src/tests/flux-security.test.ts`                                     | New tests for server-side spec validation                                    |

---

## Verification

```bash
git checkout -b feat/308-security-hardening

bun run check
bun run lint
bun run format
bun test src/tests/flux-security.test.ts

# Before PR
bun run format && bun run lint && bun run check
```

## Workflow notes

- No co-author line in commits
- Run format + lint + check before pushing
- PR: `feat/308-security-hardening` → `main`
- PR title: `feat(security): server-side validation and additional hardening for FluxCD templates (#308)`
