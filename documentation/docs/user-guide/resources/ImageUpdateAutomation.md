# ImageUpdateAutomation

Automates image updates to Git.

- **Group**: `image.toolkit.fluxcd.io`
- **Version**: `v1`

## Fields

| Field                             | Label                   | Type       | Required | Description                                   |
| --------------------------------- | ----------------------- | ---------- | -------- | --------------------------------------------- |
| `metadata.name`                   | Name                    | `string`   | Yes      | Unique name for this resource.                |
| `metadata.namespace`              | Namespace               | `string`   | Yes      | Namespace where the resource will be created. |
| `spec.sourceRef.name`             | Git Repository          | `string`   | Yes      | Name of the GitRepository to update.          |
| `spec.git.checkout.ref.branch`    | Checkout Branch         | `string`   | Yes      | Branch to checkout.                           |
| `spec.interval`                   | Update Interval         | `duration` | Yes      | How often to check for image updates.         |
| `spec.update.path`                | Update Path             | `string`   | Yes      | Path in repository to update.                 |
| `spec.update.strategy`            | Update Strategy         | `string`   | Yes      | Strategy for updating images (e.g., Setters). |
| `spec.git.push.branch`            | Push Branch             | `string`   | No       | Branch to push changes to.                    |
| `spec.git.commit.messageTemplate` | Commit Message Template | `string`   | No       | Template for commit messages.                 |

## Example

```yaml
apiVersion: image.toolkit.fluxcd.io/v1
kind: ImageUpdateAutomation
metadata:
  name: example
  namespace: flux-system
spec:
  interval: 30m
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
    push:
      branch: main
  update:
    path: ./clusters/production
    strategy: Setters
```
