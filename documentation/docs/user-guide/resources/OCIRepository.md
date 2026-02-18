# OCIRepository

Sources from an OCI registry.

- **Group**: `source.toolkit.fluxcd.io`
- **Version**: `v1beta2`

## Fields

| Field | Label | Type | Required | Description |
|-------|-------|------|----------|-------------|
| `metadata.name` | Name | `string` | Yes | Unique name for this OCIRepository resource. |
| `metadata.namespace` | Namespace | `string` | Yes | Namespace where the resource will be created. |
| `spec.url` | Repository URL | `string` | Yes | OCI repository URL (must start with oci://). |
| `spec.provider` | OCI Provider | `select` | No | Cloud provider for OCI registry authentication. |
| `spec.interval` | Sync Interval | `duration` | Yes | How often to check for changes. |
| `spec.secretRef.name` | Secret Name | `string` | No | Secret containing registry credentials. |

## Example

```yaml
apiVersion: source.toolkit.fluxcd.io/v1beta2
kind: OCIRepository
metadata:
  name: example
  namespace: flux-system
spec:
  interval: 5m
  url: oci://ghcr.io/org/manifests
  ref:
    tag: latest
```
