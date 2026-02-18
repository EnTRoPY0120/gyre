# Alert

Sends notifications for FluxCD events.

- **Group**: `notification.toolkit.fluxcd.io`
- **Version**: `v1beta3`

## Fields

| Field | Label | Type | Required | Description |
|-------|-------|------|----------|-------------|
| `metadata.name` | Name | `string` | Yes | Unique name for this Alert resource. |
| `metadata.namespace` | Namespace | `string` | Yes | Namespace where the resource will be created. |
| `spec.providerRef.name` | Provider Name | `string` | Yes | Name of the Provider resource to send notifications to. |
| `spec.eventSources` | Event Sources | `array` | Yes | Resources to monitor for events. |
| `spec.eventSeverity` | Event Severity | `select` | No | Minimum severity level to trigger alerts (info, error). |

## Example

```yaml
apiVersion: notification.toolkit.fluxcd.io/v1beta3
kind: Alert
metadata:
  name: example
  namespace: flux-system
spec:
  providerRef:
    name: slack
  eventSeverity: info
  eventSources:
    - kind: GitRepository
      name: '*'
    - kind: Kustomization
      name: '*'
```
