# Contributing to Gyre

Development setup, code conventions, testing guidance, and the pull request process are in the [Contributing Guide](https://entropy0120.github.io/gyre/contributing). Start with the [Development Guide](https://entropy0120.github.io/gyre/development) for environment setup.

## Quick start

The Dev Container installs the supported Node.js, pnpm, and Kubernetes tools. In VS Code, choose **Dev Containers: Reopen in Container**, then run:

```sh
pnpm dev
```

For a manual setup, use Node.js 22.13 or later and pnpm 11.1.0:

```sh
pnpm install
pnpm dev
```

## Checks

Run `pnpm verify:ci` for app checks and tests. Run `pnpm verify:repo:ci` for the full repository gate, including documentation, Helm, and shell scripts. Both commands check formatting without rewriting files.

Add or update tests when a change affects observable behavior or guards a meaningful regression. Prefer a focused test at the useful integration boundary; avoid tests that only repeat implementation details or exercise trivial pass-through code. Kubernetes-dependent changes may also need a cluster check, as described in the [contributing guide](https://entropy0120.github.io/gyre/contributing).

## Pull requests

Use a short Conventional Commit subject, describe the behavior changed, and include the checks you ran in the pull request. Open an issue first for larger changes or behavior changes that need discussion.

## Code of Conduct

Be respectful and constructive. We welcome contributions from people with all levels of experience.
