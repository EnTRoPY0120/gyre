# Receiver

Webhook receiver for external events.

- **Group**: `notification.toolkit.fluxcd.io`
- **Version**: `v1`

## Fields

| Field | Label | Type | Required | Description |
|-------|-------|------|----------|-------------|
| `metadata.name` | Name | `string` | Yes | Unique name for this Receiver resource. |
| `metadata.namespace` | Namespace | `string` | Yes | Namespace where the resource will be created. |
| `spec.type` | Receiver Type | `string` | Yes | Type of webhook receiver (github, gitlab, bitbucket, etc.). |
| `spec.events` | Events | `array[string]` | Yes | List of webhook events to listen for (e.g., push, pull_request, merge) that trigger reconciliation of the specified resources. |
| `spec.resources` | Resources | `array[object]` | Yes | FluxCD resources to reconcile when webhook is triggered. |
| `spec.secretRef.name` | Secret Name | `string` | Yes | Secret containing webhook validation token. |

## Example

```yaml
apiVersion: notification.toolkit.fluxcd.io/v1
kind: Receiver
metadata:
  name: example
  namespace: flux-system
spec:
  type: github
  events:
    - "ping"
    - "push"
  secretRef:
    name: webhook-token
  resources:
    - kind: GitRepository
      name: webapp
```
