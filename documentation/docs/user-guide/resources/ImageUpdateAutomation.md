# ImageUpdateAutomation

Commits automated image updates to a Git repository.

- **Group**: `image.toolkit.fluxcd.io`
- **Version**: `v1`

## Fields

| Field                          | Label          | Type       | Required | Description                                            |
| ------------------------------ | -------------- | ---------- | -------- | ------------------------------------------------------ |
| `metadata.name`                | Name           | `string`   | Yes      | Name for this ImageUpdateAutomation resource.          |
| `metadata.namespace`           | Namespace      | `string`   | Yes      | Namespace where the resource will be created.          |
| `spec.sourceRef.name`          | Git Repository | `string`   | Yes      | GitRepository containing manifests with image markers. |
| `spec.git.checkout.ref.branch` | Branch         | `string`   | No       | Git branch to check out (default: `main`).             |
| `spec.update.path`             | Update Path    | `string`   | No       | Path to search for image markers (default: `./`).      |
| `spec.interval`                | Sync Interval  | `duration` | Yes      | How often to run the automation (default: `1h`).       |

## Example

```yaml
apiVersion: image.toolkit.fluxcd.io/v1
kind: ImageUpdateAutomation
metadata:
  name: example
  namespace: flux-system
spec:
  interval: 1h
  sourceRef:
    kind: GitRepository
    name: flux-system
  git:
    checkout:
      ref:
        branch: main
    commit:
      author:
        email: fluxcdbot@example.com
        name: fluxcdbot
      messageTemplate: 'Update image'
  update:
    path: ./clusters/production
    strategy: Setters
```

See the [official ImageUpdateAutomation documentation](https://fluxcd.io/flux/components/image/imageupdateautomations/) for the complete API.
