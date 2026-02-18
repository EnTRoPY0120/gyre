# Provider

Configures a notification provider.

- **Group**: `notification.toolkit.fluxcd.io`
- **Version**: `v1beta3`

## Fields

| Field | Label | Type | Required | Description |
|-------|-------|------|----------|-------------|
| `metadata.name` | Name | `string` | Yes | Unique name for this Provider resource. |
| `metadata.namespace` | Namespace | `string` | Yes | Namespace where the resource will be created. |
| `spec.type` | Provider Type | `select` | Yes | Type of notification provider (slack, discord, msteams, etc.). |
| `spec.channel` | Channel | `string` | No | Channel name (for Slack, Discord, etc.). |
| `spec.secretRef.name` | Secret Name | `string` | No | Secret containing webhook URL or credentials. |
| `spec.address` | Address | `string` | No | Webhook URL or API address (if not in secret). |

## Example

```yaml
apiVersion: notification.toolkit.fluxcd.io/v1beta3
kind: Provider
metadata:
  name: slack
  namespace: flux-system
spec:
  type: slack
  channel: general
  secretRef:
    name: slack-webhook-url
```
