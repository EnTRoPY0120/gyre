# HelmRelease

Deploys a Helm chart.

- **Group**: `helm.toolkit.fluxcd.io`
- **Version**: `v2`

## Fields

| Field                            | Label             | Type       | Required | Description                                    |
| -------------------------------- | ----------------- | ---------- | -------- | ---------------------------------------------- |
| `metadata.name`                  | Name              | `string`   | Yes      | Unique name for this HelmRelease resource.     |
| `metadata.namespace`             | Namespace         | `string`   | Yes      | Namespace where the resource will be created.  |
| `spec.chart.spec.sourceRef.kind` | Chart Source Kind | `select`   | Yes      | Type of source containing the chart.           |
| `spec.chart.spec.sourceRef.name` | Chart Source Name | `string`   | Yes      | Name of the source resource.                   |
| `spec.chart.spec.chart`          | Chart Name        | `string`   | Yes      | Name of the Helm chart.                        |
| `spec.chart.spec.version`        | Chart Version     | `string`   | No       | SemVer version constraint or specific version. |
| `spec.interval`                  | Sync Interval     | `duration` | Yes      | How often to reconcile the release.            |
| `spec.values`                    | Values            | `textarea` | No       | Helm values to override (YAML format).         |

## Example

```yaml
apiVersion: helm.toolkit.fluxcd.io/v2
kind: HelmRelease
metadata:
  name: example
  namespace: flux-system
spec:
  interval: 5m
  chart:
    spec:
      chart: podinfo
      version: '>=1.0.0'
      sourceRef:
        kind: HelmRepository
        name: bitnami
        namespace: flux-system
```
