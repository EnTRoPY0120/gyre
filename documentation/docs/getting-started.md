---
sidebar_position: 2
---

# Getting Started

Gyre is a web interface for Flux resources in Kubernetes. Production installs run in-cluster through Helm or Flux; local mode is intended for development and testing.

## Install

Follow the [Installation guide](/installation) for Helm and GitOps setup, supported local workflows, and production access. The chart creates and retains encryption and metrics Secrets by default. For production, use externally managed Secrets when your deployment process requires them.

## First login

After the Gyre pod is ready, read the initial admin password from the configured Secret. The default name is `gyre-initial-admin-secret`; if you configured another name in Helm, set `GYRE_ADMIN_SECRET_NAME` in your shell to that same value before running the command.

```sh
kubectl get secret "${GYRE_ADMIN_SECRET_NAME:-gyre-initial-admin-secret}" -n flux-system \
  -o jsonpath='{.data.password}' | base64 -d && echo
kubectl port-forward -n flux-system svc/gyre 3000:80
```

Open http://localhost:3000 and sign in as `admin`. In-cluster admin passwords stay managed by the Kubernetes Secret; rotate one through the [troubleshooting steps](/troubleshooting#cannot-login). Local accounts can change their password from the account menu after signing in.

## Next steps

- [Configure Gyre](/configuration)
- [Explore features](/features)
- [Create a Flux resource](/user-guide/resource-wizard)
- [Troubleshoot an installation](/troubleshooting)
