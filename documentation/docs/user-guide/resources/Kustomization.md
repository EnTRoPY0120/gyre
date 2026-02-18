# Kustomization

Deploys resources defined in a source via Kustomize.

- **Group**: `kustomize.toolkit.fluxcd.io`
- **Version**: `v1`

## Fields

| Field                      | Label                   | Type            | Required | Description                                                              |
| -------------------------- | ----------------------- | --------------- | -------- | ------------------------------------------------------------------------ |
| `metadata.name`            | Name                    | `string`        | Yes      | Unique name for this Kustomization resource.                             |
| `metadata.namespace`       | Namespace               | `string`        | Yes      | Namespace where the resource will be created.                            |
| `spec.sourceRef.kind`      | Source Kind             | `string`        | Yes      | Type of source to reconcile from (GitRepository, OCIRepository, Bucket). |
| `spec.sourceRef.name`      | Source Name             | `string`        | Yes      | Name of the source resource.                                             |
| `spec.sourceRef.namespace` | Source Namespace        | `string`        | No       | Namespace of the source resource.                                        |
| `spec.path`                | Path                    | `string`        | No       | Path to the directory containing Kustomize files.                        |
| `spec.interval`            | Sync Interval           | `duration`      | Yes      | How often to reconcile the Kustomization.                                |
| `spec.prune`               | Prune Resources         | `boolean`       | Yes      | Delete resources removed from source.                                    |
| `spec.retryInterval`       | Retry Interval          | `duration`      | No       | Interval at which to retry a failed reconciliation.                      |
| `spec.timeout`             | Timeout                 | `duration`      | No       | Timeout for apply and health check operations.                           |
| `spec.wait`                | Wait for Resources      | `boolean`       | No       | Wait for all resources to become ready.                                  |
| `spec.suspend`             | Suspend                 | `boolean`       | No       | Suspend reconciliation of this resource.                                 |
| `spec.force`               | Force Apply             | `boolean`       | No       | Force resource updates through delete/recreate if needed.                |
| `spec.serviceAccountName`  | Service Account         | `string`        | No       | ServiceAccount to impersonate for reconciliation.                        |
| `spec.targetNamespace`     | Target Namespace        | `string`        | No       | Override namespace for all resources.                                    |
| `spec.dependsOn`           | Dependencies            | `array[object]` | No       | List of Kustomizations this depends on.                                  |
| `spec.healthChecks`        | Health Checks           | `array[object]` | No       | List of resources to be included in health assessment.                   |
| `spec.deletionPolicy`      | Deletion Policy         | `string`        | No       | Control garbage collection when Kustomization is deleted.                |
| `spec.commonMetadata`      | Common Metadata         | `object`        | No       | Labels and annotations to apply to all resources.                        |
| `spec.namePrefix`          | Name Prefix             | `string`        | No       | Prefix to add to all resource names.                                     |
| `spec.nameSuffix`          | Name Suffix             | `string`        | No       | Suffix to add to all resource names.                                     |
| `spec.images`              | Images                  | `array[object]` | No       | Override container images.                                               |
| `spec.patches`             | Strategic Merge Patches | `array[object]` | No       | Strategic merge patches to apply.                                        |
| `spec.postBuild`           | Post Build              | `object`        | No       | Variable substitution after manifests are built.                         |
| `spec.decryption`          | Decryption              | `object`        | No       | Secrets decryption configuration (e.g., SOPS).                           |
| `spec.kubeConfig`          | Remote KubeConfig       | `object`        | No       | KubeConfig for remote cluster deployment.                                |

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
