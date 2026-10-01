# Gyre

[![Documentation](https://img.shields.io/badge/docs-entropy0120.github.io%2Fgyre-gold?style=for-the-badge)](https://entropy0120.github.io/gyre/)
[![GitHub release](https://img.shields.io/github/v/release/entropy0120/gyre?style=for-the-badge)](https://github.com/entropy0120/gyre/releases)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg?style=for-the-badge)](LICENSE)

Gyre is a web UI for FluxCD with real-time resource monitoring, multi-cluster management, built-in RBAC, and support for 13 GitOps Toolkit resources.

Production deployments run in-cluster through Helm or Flux. Out-of-cluster mode is intended for development and testing.

## Quick start

Install Gyre in the `flux-system` namespace (the command uses the current example version):

```sh
helm install gyre oci://ghcr.io/entropy0120/charts/gyre \
  --version 0.7.1 \
  --namespace flux-system \
  --create-namespace
```

The chart creates and retains the required encryption and metrics Secrets. See the [installation guide](https://entropy0120.github.io/gyre/installation) for GitOps installs, external Secrets, production access, local demos, and the [latest release](https://github.com/entropy0120/gyre/releases/latest).

Get the initial admin password and open Gyre through a port-forward:

```sh
kubectl get secret "${GYRE_ADMIN_SECRET_NAME:-gyre-initial-admin-secret}" -n flux-system \
  -o jsonpath='{.data.password}' | base64 -d && echo
kubectl port-forward -n flux-system svc/gyre 3000:80
```

Then visit [http://localhost:3000](http://localhost:3000) and sign in as `admin`.

If you set a custom `admin.secretName`, set `GYRE_ADMIN_SECRET_NAME` in your shell to the same name before running the password command.

## Development

Use the [development guide](https://entropy0120.github.io/gyre/development) for setup, commands, and local cluster workflows. The Dev Container is the recommended environment.

Run the app checks with `pnpm verify:ci`; run the complete repository gate with `pnpm verify:repo:ci`. See the [contributing guide](https://entropy0120.github.io/gyre/contributing) for the test policy and pull request process.

## Documentation

The full documentation is at [entropy0120.github.io/gyre](https://entropy0120.github.io/gyre/). To work on the docs site locally, follow [documentation/README.md](documentation/README.md).

## License

Distributed under the MIT License. See [LICENSE](LICENSE).
