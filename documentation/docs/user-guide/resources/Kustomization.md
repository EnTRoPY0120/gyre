# Kustomization

Deploys resources defined in a source via Kustomize.

- **Group**: `kustomize.toolkit.fluxcd.io`
- **Version**: `v1`

## Fields

| Field | Label | Type | Required | Description |
|-------|-------|------|----------|-------------|
| `metadata.name` | Name | `string` | Yes | Unique name for this Kustomization resource. |
| `metadata.namespace` | Namespace | `string` | Yes | Namespace where the resource will be created. |
| `spec.sourceRef.kind` | Source Kind | `select` | Yes | Type of source to reconcile from (GitRepository, OCIRepository, Bucket). |
| `spec.sourceRef.name` | Source Name | `string` | Yes | Name of the source resource. |
| `spec.path` | Path | `string` | No | Path to the directory containing Kustomize files. |
| `spec.interval` | Sync Interval | `duration` | Yes | How often to reconcile the Kustomization. |
| `spec.prune` | Prune Resources | `boolean` | No | Delete resources removed from source (default: `true`). |
| `spec.wait` | Wait for Resources | `boolean` | No | Wait for all resources to become ready. |

## Example

```yaml
apiVersion: kustomize.toolkit.fluxcd.io/v1
kind: Kustomization
metadata:
  name: example
  namespace: flux-system
spec:
  interval: 5m
  path: ./deploy
  prune: true
  sourceRef:
    kind: GitRepository
    name: flux-system
```
