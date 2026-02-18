# HelmChart

References a Helm chart from a repository.

- **Group**: `source.toolkit.fluxcd.io`
- **Version**: `v1`

## Fields

| Field | Label | Type | Required | Description |
|-------|-------|------|----------|-------------|
| `metadata.name` | Name | `string` | Yes | Unique name for this HelmChart resource. |
| `metadata.namespace` | Namespace | `string` | Yes | Namespace where the resource will be created. |
| `spec.sourceRef.kind` | Source Kind | `select` | Yes | Type of source containing the chart (HelmRepository, GitRepository, Bucket). |
| `spec.sourceRef.name` | Source Name | `string` | Yes | Name of the source resource. |
| `spec.chart` | Chart Name | `string` | Yes | Name of the Helm chart. |
| `spec.version` | Chart Version | `string` | No | SemVer version constraint (default: `*`). |
| `spec.interval` | Sync Interval | `duration` | Yes | How often to check for new chart versions. |

## Example

```yaml
apiVersion: source.toolkit.fluxcd.io/v1
kind: HelmChart
metadata:
  name: example
  namespace: flux-system
spec:
  interval: 5m
  chart: podinfo
  version: ">=1.0.0"
  sourceRef:
    kind: HelmRepository
    name: podinfo
```
