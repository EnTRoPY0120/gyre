# ImagePolicy

Defines policies for selecting image versions.

- **Group**: `image.toolkit.fluxcd.io`
- **Version**: `v1beta2`

## Fields

| Field                          | Label               | Type     | Required | Description                                     |
| ------------------------------ | ------------------- | -------- | -------- | ----------------------------------------------- |
| `metadata.name`                | Name                | `string` | Yes      | Unique name for this ImagePolicy resource.      |
| `metadata.namespace`           | Namespace           | `string` | Yes      | Namespace where the resource will be created.   |
| `spec.imageRepositoryRef.name` | Image Repository    | `string` | Yes      | Name of the ImageRepository to apply policy to. |
| `spec.policy.semver.range`     | Semver Range        | `string` | No       | Semver constraint (e.g., `>=1.0.0`).            |
| `spec.filterTags.pattern`      | Filter Tags Pattern | `string` | No       | Regular expression to filter image tags.        |

## Example

```yaml
apiVersion: image.toolkit.fluxcd.io/v1beta2
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
