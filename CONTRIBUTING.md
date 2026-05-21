# Contributing to Gyre

Thank you for your interest in contributing to Gyre!

Comprehensive contributing guidelines, including development setup, code standards, commit message conventions, and pull request processes, have been moved to our documentation site:

**[📚 Contributing Guide](https://entropy0120.github.io/gyre/contributing)**

## Quick Start (DevContainer)

The repository includes a devcontainer that installs Node.js 22.13+, `pnpm@11.1.0`, and Kubernetes tooling.

1. Open the repository in VS Code with the **Dev Containers** extension.
2. Press `F1` → **"Dev Containers: Reopen in Container"**.
3. Wait for `.devcontainer/post-create.sh` to install dependencies.
4. Inside the container, run:
   ```bash
   pnpm dev
   ```

The host kubeconfig is mounted read-only from `~/.kube`; use an existing cluster or create one manually with `kind` and `flux` when needed.

## Key Commands

- `pnpm install` - Install dependencies
- `pnpm dev` - Start development server
- `pnpm verify` - App-only local gate (auto-format + lint + typecheck + build)
- `pnpm verify:ci` - App-only strict gate (format:check + lint + typecheck + tests + build)
- `pnpm docs:check` - Documentation typecheck + build
- `pnpm helm:check` - Helm chart lint check
- `pnpm scripts:check` - Shell script syntax check (`bash -n`)
- `pnpm verify:repo` - Repo gate for app + Helm + shell scripts
- `pnpm verify:repo:ci` - Full CI repo gate for app + docs + Helm + shell scripts
- `pnpm test` - Full Vitest test suite (requires Helm on PATH for chart render regression tests)

Tests run through Vitest on Node.js.

## Questions?

- Open an issue for questions.
- Join discussions in existing issues and PRs.

## Code of Conduct

Be respectful and constructive in all interactions. We welcome contributors of all experience levels and backgrounds.

---

Thank you for contributing to Gyre! 🎉
