# ImageRepository

Scans container image repositories.

- **Group**: `image.toolkit.fluxcd.io`
- **Version**: `v1beta2`

## Fields

| Field                 | Label         | Type       | Required | Description                                    |
| --------------------- | ------------- | ---------- | -------- | ---------------------------------------------- |
| `metadata.name`       | Name          | `string`   | Yes      | Unique name for this ImageRepository resource. |
| `metadata.namespace`  | Namespace     | `string`   | Yes      | Namespace where the resource will be created.  |
| `spec.image`          | Image         | `string`   | Yes      | Container image repository to scan.            |
| `spec.interval`       | Scan Interval | `duration` | Yes      | How often to scan for new images.              |
| `spec.secretRef.name` | Secret Name   | `string`   | No       | Secret containing registry credentials.        |

## Example

```yaml
apiVersion: image.toolkit.fluxcd.io/v1beta2
kind: ImageRepository
metadata:
  name: example
  namespace: flux-system
spec:
  interval: 5m
  image: ghcr.io/org/app
```
