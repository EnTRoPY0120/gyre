# HelmRepository

Sources from a Helm chart repository.

- **Group**: `source.toolkit.fluxcd.io`
- **Version**: `v1`

## Fields

| Field                 | Label           | Type       | Required | Description                                   |
| --------------------- | --------------- | ---------- | -------- | --------------------------------------------- |
| `metadata.name`       | Name            | `string`   | Yes      | Unique name for this HelmRepository resource. |
| `metadata.namespace`  | Namespace       | `string`   | Yes      | Namespace where the resource will be created. |
| `spec.type`           | Repository Type | `select`   | No       | Type of Helm repository (default, oci).       |
| `spec.url`            | Repository URL  | `string`   | Yes      | HTTP/S or OCI registry URL.                   |
| `spec.interval`       | Sync Interval   | `duration` | Yes      | How often to check for new chart versions.    |
| `spec.secretRef.name` | Secret Name     | `string`   | No       | Secret containing authentication credentials. |
| `spec.suspend`        | Suspend         | `boolean`  | No       | Suspend reconciliation of this repository.    |

## Example

```yaml
apiVersion: source.toolkit.fluxcd.io/v1
kind: HelmRepository
metadata:
  name: example
  namespace: flux-system
spec:
  interval: 5m
  url: https://charts.bitnami.com/bitnami
```
