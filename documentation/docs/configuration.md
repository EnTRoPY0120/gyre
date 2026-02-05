---
sidebar_position: 3
---

# Configuration

Configure Gyre to suit your environment and requirements.

## Overview

Gyre can be configured through:

1. Helm values (recommended)
2. Environment variables
3. Configuration file

## Helm Configuration

### Basic Configuration

Create a `values.yaml` file:

```yaml
# replicas
replicaCount: 1

# image
image:
  repository: ghcr.io/entropy0120/gyre
  tag: latest
  pullPolicy: IfNotPresent

# service
service:
  type: ClusterIP
  port: 80

# ingress
ingress:
  enabled: false
  className: nginx
  annotations: {}
  hosts:
    - host: gyre.local
      paths:
        - path: /
          pathType: Prefix
```

### Database Configuration

Configure SQLite database:

```yaml
persistence:
  enabled: true
  storageClass: standard
  accessMode: ReadWriteOnce
  size: 1Gi
```

### Resource Configuration

Adjust resource limits:

```yaml
resources:
  limits:
    cpu: 1000m
    memory: 512Mi
  requests:
    cpu: 100m
    memory: 128Mi
```

## Authentication Configuration

### Local Authentication

Enable local authentication (default):

```yaml
auth:
  local:
    enabled: true
```

### SSO/OAuth Configuration

Configure OAuth providers:

```yaml
auth:
  oauth:
    enabled: true
    providers:
      - name: github
        type: github
        clientId: 'your-github-client-id'
        clientSecret: 'your-github-client-secret'

      - name: google
        type: google
        clientId: 'your-google-client-id'
        clientSecret: 'your-google-client-secret'

      - name: oidc
        type: oidc
        clientId: 'your-oidc-client-id'
        clientSecret: 'your-oidc-client-secret'
        issuer: 'https://your-oidc-provider.com'
```

## Session Configuration

Configure session settings:

```yaml
session:
  cookieName: gyre_session
  maxAge: 86400 # 24 hours in seconds
  secure: true # Use secure cookies
  sameSite: lax
```

## Multi-Cluster Configuration

Add cluster contexts:

```yaml
clusters:
  - name: production
    context: prod-cluster
    kubeconfig: |
      apiVersion: v1
      kind: Config
      ...

  - name: staging
    context: staging-cluster
    kubeconfig: |
      ...
```

## Environment Variables

You can also configure Gyre using environment variables:

| Variable         | Description            | Default         |
| ---------------- | ---------------------- | --------------- |
| `ADMIN_PASSWORD` | Initial admin password | Auto-generated  |
| `SESSION_SECRET` | Session encryption key | Auto-generated  |
| `DATABASE_PATH`  | SQLite database path   | `/data/gyre.db` |
| `LOG_LEVEL`      | Logging level          | `info`          |

### Example

```yaml
env:
  - name: LOG_LEVEL
    value: debug
  - name: SESSION_SECRET
    valueFrom:
      secretKeyRef:
        name: gyre-session-secret
        key: secret
```

## RBAC Configuration

### Default Policies

Create default RBAC policies:

```yaml
rbac:
  policies:
    - name: viewer
      rules:
        - resources: ['*']
          namespaces: ['*']
          actions: ['view']

    - name: editor
      rules:
        - resources: ['*']
          namespaces: ['*']
          actions: ['view', 'edit', 'reconcile']

    - name: admin
      rules:
        - resources: ['*']
          namespaces: ['*']
          actions: ['*']
```

### User Assignments

Assign policies to users:

```yaml
rbac:
  bindings:
    - user: admin
      policy: admin
      cluster: '*'
```

## Advanced Configuration

### Caching

Configure caching behavior:

```yaml
cache:
  enabled: true
  ttl: 30 # seconds
```

### WebSocket

Configure WebSocket settings:

```yaml
websocket:
  enabled: true
  pingInterval: 30 # seconds
  reconnectInterval: 5 # seconds
```

### Audit Logging

Enable audit logging:

```yaml
audit:
  enabled: true
  retention: 90 # days
```

## Applying Configuration

### Via Helm

```bash
helm upgrade gyre gyre/gyre \
  --namespace flux-system \
  -f values.yaml
```

### Via kubectl

Edit the ConfigMap:

```bash
kubectl edit configmap gyre-config -n flux-system
```

Then restart the deployment:

```bash
kubectl rollout restart deployment gyre -n flux-system
```

## Configuration Reference

### Full values.yaml Example

```yaml
# Default values for gyre
replicaCount: 1

image:
  repository: ghcr.io/entropy0120/gyre
  tag: latest
  pullPolicy: IfNotPresent

service:
  type: ClusterIP
  port: 80

ingress:
  enabled: false
  className: nginx
  annotations: {}
  hosts: []
  tls: []

persistence:
  enabled: true
  storageClass: standard
  accessMode: ReadWriteOnce
  size: 1Gi

resources:
  limits:
    cpu: 1000m
    memory: 512Mi
  requests:
    cpu: 100m
    memory: 128Mi

auth:
  local:
    enabled: true
  oauth:
    enabled: false
    providers: []

rbac:
  enabled: true
  policies: []
  bindings: []

clusterRole:
  create: true
  rules: []

serviceAccount:
  create: true
  annotations: {}

podAnnotations: {}
podSecurityContext: {}
securityContext: {}
nodeSelector: {}
tolerations: []
affinity: {}
```

## Troubleshooting

### Configuration Not Applied

1. Check ConfigMap exists:

   ```bash
   kubectl get configmap -n flux-system
   ```

2. Verify pod is using latest config:

   ```bash
   kubectl describe pod -n flux-system -l app.kubernetes.io/name=gyre
   ```

3. Check logs:
   ```bash
   kubectl logs -n flux-system -l app.kubernetes.io/name=gyre
   ```

### Common Issues

- **Changes not reflected**: Restart the deployment
- **Permission errors**: Check RBAC policies
- **Auth failures**: Verify OAuth credentials
