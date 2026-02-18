# GitRepository

Sources from a Git repository.

- **Group**: `source.toolkit.fluxcd.io`
- **Version**: `v1`

## Fields

| Field | Label | Type | Required | Description |
|-------|-------|------|----------|-------------|
| `metadata.name` | Name | `string` | Yes | Unique name for this GitRepository resource. |
| `metadata.namespace` | Namespace | `string` | Yes | Namespace where the resource will be created. |
| `spec.url` | Repository URL | `string` | Yes | Git repository URL (https://, ssh://, or git@). |
| `spec.provider` | Git Provider | `select` | No | Git provider optimization (generic, github, azure). |
| `spec.ref.branch` | Branch | `string` | No | Branch name to track (default: `main`). |
| `spec.interval` | Sync Interval | `duration` | Yes | How often to check for repository changes (e.g., 1m). |
| `spec.secretRef.name` | Secret Name | `string` | No | Name of secret containing authentication credentials. |
| `spec.suspend` | Suspend | `boolean` | No | Suspend reconciliation of this repository. |
| `spec.timeout` | Timeout | `duration` | No | Timeout for Git operations. |

## Example

```yaml
apiVersion: source.toolkit.fluxcd.io/v1
kind: GitRepository
metadata:
  name: example
  namespace: flux-system
spec:
  interval: 1m
  url: https://github.com/org/repo
  ref:
    branch: main
```
