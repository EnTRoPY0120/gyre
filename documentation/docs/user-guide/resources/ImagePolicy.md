# ImagePolicy

Selects an image tag from an ImageRepository according to a version policy.

- **Group**: `image.toolkit.fluxcd.io`
- **Version**: `v1`

## Fields

| Field                            | Label            | Type     | Required | Description                                               |
| -------------------------------- | ---------------- | -------- | -------- | --------------------------------------------------------- |
| `metadata.name`                  | Name             | `string` | Yes      | Unique name for this ImagePolicy resource.                |
| `metadata.namespace`             | Namespace        | `string` | Yes      | Namespace where the resource will be created.             |
| `spec.imageRepositoryRef.name`   | Image Repository | `string` | Yes      | ImageRepository to monitor.                               |
| Policy type (wizard control)     | Policy Type      | `select` | No       | Selects SemVer, numerical, or alphabetical policy fields. |
| `spec.policy.semver.range`       | Semver Range     | `string` | No       | SemVer range used to select a tag (default: `>=1.0.0`).   |
| `spec.policy.numerical.order`    | Order            | `select` | No       | Numerical sort order (`asc` or `desc`).                   |
| `spec.policy.alphabetical.order` | Order            | `select` | No       | Alphabetical sort order (`asc` or `desc`).                |

## Example

```yaml
apiVersion: image.toolkit.fluxcd.io/v1
kind: ImagePolicy
metadata:
  name: example
  namespace: flux-system
spec:
  imageRepositoryRef:
    name: example
  policy:
    semver:
      range: '>=1.0.0'
```

See the [official ImagePolicy documentation](https://fluxcd.io/flux/components/image/imagepolicies/) for the complete API.
