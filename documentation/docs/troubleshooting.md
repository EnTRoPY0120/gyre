---
sidebar_position: 8
---

# Troubleshooting

Common issues and their solutions.

## Installation Issues

### Pod Not Starting

**Symptom**: Pod stays in `Pending` or `CrashLoopBackOff`

**Solutions**:

1. Check pod status:

   ```bash
   kubectl get pods -n flux-system -l app.kubernetes.io/name=gyre
   ```

2. Check events:

   ```bash
   kubectl describe pod -n flux-system -l app.kubernetes.io/name=gyre
   ```

3. Common causes:
   - Insufficient resources (increase limits)
   - PersistentVolume not available (check storage class)
   - Image pull errors (check image tag and registry access)

### Cannot Access Web UI

**Symptom**: Connection refused or timeout

**Solutions**:

1. Check service:

   ```bash
   kubectl get svc -n flux-system gyre
   ```

2. Verify pod is running:

   ```bash
   kubectl get pods -n flux-system -l app.kubernetes.io/name=gyre
   ```

3. Test port-forward:
   ```bash
   kubectl port-forward -n flux-system svc/gyre 3000:80
   ```

## Authentication Issues

### Cannot Login

**Symptom**: "Invalid credentials" error

**Solutions**:

1. Get admin password:

   ```bash
   kubectl get secret gyre-initial-admin-secret \
     -n flux-system \
     -o jsonpath='{.data.password}' | base64 -d
   ```

2. Check if password was changed:

   ```bash
   kubectl logs -n flux-system -l app.kubernetes.io/name=gyre | grep password
   ```

3. Reset admin password (requires database access):
   ```bash
   kubectl exec -it -n flux-system \
     deployment/gyre -- \
     sh -c 'sqlite3 /data/gyre.db "UPDATE users SET password_hash = \"new_hash\" WHERE username = \"admin\";"'
   ```

### OAuth Login Fails

**Symptom**: Redirect loop or "Authentication failed"

**Solutions**:

1. Verify OAuth credentials:

   ```bash
   kubectl get secret -n flux-system | grep oauth
   ```

2. Check callback URL is correct in OAuth provider

3. Verify Gyre URL matches OAuth configuration

4. Check logs:
   ```bash
   kubectl logs -n flux-system -l app.kubernetes.io/name=gyre | grep oauth
   ```

## Cluster Connection Issues

### Cannot Connect to Cluster

**Symptom**: "Cluster unavailable" or timeout

**Solutions**:

1. Verify ServiceAccount permissions:

   ```bash
   kubectl auth can-i --list --as=system:serviceaccount:flux-system:gyre
   ```

2. Check ClusterRoleBinding:

   ```bash
   kubectl get clusterrolebinding | grep gyre
   ```

3. Test K8s API access from pod:
   ```bash
   kubectl exec -it -n flux-system \
     deployment/gyre -- \
     curl -k https://kubernetes.default.svc/healthz
   ```

### Multi-Cluster Issues

**Symptom**: Cannot see resources from other clusters

**Solutions**:

1. Verify kubeconfig is valid:

   ```bash
   kubectl config view --raw
   ```

2. Check cluster context exists:

   ```bash
   kubectl config get-contexts
   ```

3. Test cluster connection:
   ```bash
   kubectl --context=other-cluster get nodes
   ```

## Performance Issues

### Slow Loading

**Symptom**: Pages take long to load

**Solutions**:

1. Increase resources:

   ```yaml
   resources:
     limits:
       cpu: 2000m
       memory: 1Gi
   ```

2. Check database size:

   ```bash
   kubectl exec -it -n flux-system \
     deployment/gyre -- \
     ls -lh /data/gyre.db
   ```

3. Clear cache:
   ```bash
   kubectl rollout restart deployment -n flux-system gyre
   ```

### High Memory Usage

**Symptom**: OOMKilled or high memory usage

**Solutions**:

1. Check for memory leaks:

   ```bash
   kubectl top pod -n flux-system -l app.kubernetes.io/name=gyre
   ```

2. Reduce cache TTL:

   ```yaml
   cache:
     ttl: 10 # seconds
   ```

3. Limit concurrent connections

## Resource Display Issues

### Resources Not Showing

**Symptom**: Empty list or "No resources found"

**Solutions**:

1. Verify FluxCD is installed:

   ```bash
   kubectl get pods -n flux-system
   ```

2. Check resource exists:

   ```bash
   kubectl get kustomizations -A
   ```

3. Verify RBAC permissions

4. Check logs:
   ```bash
   kubectl logs -n flux-system -l app.kubernetes.io/name=gyre | grep error
   ```

### Wrong Status Displayed

**Symptom**: Status doesn't match actual resource state

**Solutions**:

1. Refresh page (hard refresh: Ctrl+Shift+R)

2. Check WebSocket connection in browser DevTools

3. Restart Gyre pod:
   ```bash
   kubectl rollout restart deployment -n flux-system gyre
   ```

## Database Issues

### Database Locked

**Symptom**: "database is locked" errors

**Solutions**:

1. Restart the pod:

   ```bash
   kubectl rollout restart deployment -n flux-system gyre
   ```

2. Check disk space:
   ```bash
   kubectl exec -it -n flux-system \
     deployment/gyre -- \
     df -h
   ```

### Data Loss

**Symptom**: Users, settings, or data missing

**Solutions**:

1. Check PersistentVolume:

   ```bash
   kubectl get pvc -n flux-system
   ```

2. Verify data exists:

   ```bash
   kubectl exec -it -n flux-system \
     deployment/gyre -- \
     sqlite3 /data/gyre.db ".tables"
   ```

3. Restore from backup if available

## Getting Help

If you can't resolve the issue:

1. **Check logs**:

   ```bash
   kubectl logs -n flux-system -l app.kubernetes.io/name=gyre --tail=100
   ```

2. **Gather information**:
   - Gyre version
   - Kubernetes version
   - FluxCD version
   - Browser console errors

3. **Open an issue**:
   - [GitHub Issues](https://github.com/entropy0120/gyre/issues)
   - Include logs and reproduction steps
