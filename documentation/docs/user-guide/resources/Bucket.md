# Bucket

Sources from an S3-compatible bucket.

- **Group**: `source.toolkit.fluxcd.io`
- **Version**: `v1`

## Fields

| Field                 | Label         | Type       | Required | Description                                     |
| --------------------- | ------------- | ---------- | -------- | ----------------------------------------------- |
| `metadata.name`       | Name          | `string`   | Yes      | Unique name for this Bucket resource.           |
| `metadata.namespace`  | Namespace     | `string`   | Yes      | Namespace where the resource will be created.   |
| `spec.provider`       | Provider      | `select`   | Yes      | Cloud provider type (generic, aws, gcp, azure). |
| `spec.bucketName`     | Bucket Name   | `string`   | Yes      | Name of the S3 bucket.                          |
| `spec.endpoint`       | Endpoint      | `string`   | Yes      | S3-compatible endpoint URL.                     |
| `spec.interval`       | Sync Interval | `duration` | Yes      | How often to check for changes.                 |
| `spec.secretRef.name` | Secret Name   | `string`   | No       | Secret containing access key and secret key.    |

## Example

```yaml
apiVersion: source.toolkit.fluxcd.io/v1
kind: Bucket
metadata:
  name: example
  namespace: flux-system
spec:
  interval: 5m
  provider: generic
  bucketName: my-bucket
  endpoint: s3.amazonaws.com
```
