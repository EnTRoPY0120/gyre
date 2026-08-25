# ImageRepository

Scans a container image repository and records its available tags.

- **Group**: `image.toolkit.fluxcd.io`
- **Version**: `v1`

## Fields

| Field                | Label             | Type       | Required | Description                                              |
| -------------------- | ----------------- | ---------- | -------- | -------------------------------------------------------- |
| `metadata.name`      | Name              | `string`   | Yes      | Unique name for this ImageRepository resource.           |
| `metadata.namespace` | Namespace         | `string`   | Yes      | Namespace where the resource will be created.            |
| `spec.image`         | Image             | `string`   | Yes      | Container image repository to scan.                      |
| `spec.provider`      | Registry Provider | `select`   | No       | Registry provider (`generic`, `aws`, `azure`, or `gcp`). |
| `spec.interval`      | Scan Interval     | `duration` | Yes      | How often to scan for new images (for example, `5m`).    |

## Example

```yaml
apiVersion: image.toolkit.fluxcd.io/v1
kind: ImageRepository
metadata:
  name: example
  namespace: flux-system
spec:
  interval: 5m
  image: ghcr.io/org/app
```

See the [official ImageRepository documentation](https://fluxcd.io/flux/components/image/imagerepositories/) for the complete API.
