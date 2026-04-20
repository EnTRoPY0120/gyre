# Contributing to Gyre

Thank you for your interest in contributing to Gyre!

Comprehensive contributing guidelines, including development setup, code standards, commit message conventions, and pull request processes, have been moved to our documentation site:

**[📚 Contributing Guide](https://entropy0120.github.io/gyre/contributing)**

## Quick Start (DevContainer)

The easiest way to start developing is using the provided devcontainer:

1. Open the repository in VS Code with the **Dev Containers** extension.
2. Press `F1` → **"Dev Containers: Reopen in Container"**.
3. The container setup:
   - installs Bun (if missing),
   - runs `bun install`,
   - mounts your host `~/.kube` at `/home/node/.kube` (read-only),
   - installs Svelte/Tailwind/YAML/Kubernetes VS Code extensions.
4. Inside the container, run:
   ```bash
   bun run dev
   ```

## Key Commands

- `bun install` - Install dependencies
- `bun run dev` - Start development server
- `bun run verify` - App-only local gate (auto-format + lint + typecheck + build)
- `bun run verify:ci` - App-only strict gate (format:check + lint + typecheck + tests + build)
- `bun run docs:check` - Documentation typecheck + build (requires `npm ci --prefix documentation`)
- `bun run helm:check` - Helm chart lint check
- `bun run scripts:check` - Shell script syntax check (`bash -n`)
- `bun run verify:repo` - Repo gate for app + Helm + shell scripts
- `bun run verify:repo:ci` - Full CI repo gate for app + docs + Helm + shell scripts
- `bun test` - Full Bun test suite (requires Helm on PATH for chart render regression tests)

## Questions?

- Open an issue for questions.
- Join discussions in existing issues and PRs.

## Code of Conduct

Be respectful and constructive in all interactions. We welcome contributors of all experience levels and backgrounds.

---

Thank you for contributing to Gyre! 🎉
