# Contributing to Gyre

Thank you for your interest in contributing to Gyre! This document outlines the standards and processes for contributing to this project.

## Table of Contents

- [Getting Started](#getting-started)
- [Development Setup](#development-setup)
- [Code Standards](#code-standards)
- [Commit Message Convention](#commit-message-convention)
- [Pull Request Process](#pull-request-process)
- [Testing](#testing)
- [Reporting Issues](#reporting-issues)
- [Adding New Features](#adding-new-features)

## Getting Started

### Prerequisites

- [Bun](https://bun.sh/) (latest version)
- [Node.js](https://nodejs.org/) 18+ (for some dev tools)
- A Kubernetes cluster with FluxCD installed (for testing)
- Git

### Quick Start (DevContainer - Recommended)

The easiest way to start developing is using the provided devcontainer:

1. Open the repository in VS Code with the Dev Containers extension
2. Press `F1` → "Dev Containers: Reopen in Container"
3. The devcontainer automatically installs Bun, VS Code extensions, mounts `~/.kube`, and runs setup
4. Optional: Create a local kind cluster with FluxCD for testing

```bash
# Inside devcontainer, start development server
bun run dev

# Optional: Create test cluster
kind create cluster
flux install
```

### Manual Setup

```bash
# Install dependencies
bun install

# Start development server
bun run dev

# Or start with auto-open
bun run dev --open
```

## Development Setup

### Project Structure

```
gyre/
├── src/
│   ├── lib/
│   │   ├── components/     # Reusable UI components
│   │   ├── server/         # Server-only code (DB, auth, K8s)
│   │   ├── templates/      # Resource creation templates
│   │   └── stores/         # Svelte 5 runes-based stores
│   └── routes/             # SvelteKit routes
├── charts/gyre/            # Helm chart for deployment
├── documentation/          # Docusaurus docs site
└── data/                   # SQLite database (dev)
```

### Important Architecture Notes

1. **Server vs Client Code**: Code in `src/lib/server/` ONLY runs server-side. Never import from there in `.svelte` component `<script>` tags—use SvelteKit load functions instead.

2. **Svelte 5 Runes**: This project uses Svelte 5 with runes (`$state`, `$derived`, `$effect`, `$props`). Do NOT use legacy Svelte syntax:

   ```svelte
   <!-- Good -->
   <script>
     let count = $state(0);
     let doubled = $derived(count * 2);
   </script>

   <!-- Bad -->
   <script>
     let count = 0;
     $: doubled = count * 2;
   </script>
   ```

3. **In-Cluster Only**: Gyre is designed to run inside Kubernetes clusters only. It cannot run locally with kubeconfig.

## Code Standards

### TypeScript

- **Strict mode enabled**: All code must pass TypeScript strict checks
- Use explicit types for function parameters and return values
- Avoid `any` type—use `unknown` with type guards when necessary

### Code Quality Commands

Always run these before committing:

```bash
# Type-check
bun run check

# Lint and format check
bun run lint

# Auto-format code
bun run format
```

### Styling

- **TailwindCSS v4**: Uses the Vite plugin (not PostCSS)
- Use Tailwind utility classes for styling
- Follow the existing zinc/gold theme color palette
- Use shadcn-svelte components for consistency

### Component Guidelines

1. Use TypeScript for all `.svelte` files: `<script lang="ts">`
2. Keep components focused and single-responsibility
3. Use Svelte 5 snippets for reusable template blocks
4. Properly type props with `$props()` rune
5. Use the `class` prop pattern for component customization:

   ```typescript
   import { cn } from '$lib/utils.js';

   let { class: className, ...props }: { class?: string } = $props();
   ```

## Commit Message Convention

We follow the [Conventional Commits](https://www.conventionalcommits.org/) specification:

```
<type>(<scope>): <description>

[optional body]

[optional footer(s)]
```

### Types

- **feat**: A new feature
- **fix**: A bug fix
- **docs**: Documentation only changes
- **style**: Code style changes (formatting, semicolons, etc.)
- **refactor**: Code change that neither fixes a bug nor adds a feature
- **perf**: Performance improvement
- **test**: Adding or correcting tests
- **chore**: Changes to build process or auxiliary tools
- **ci**: Changes to CI configuration files

### Scopes

Common scopes in this project:

- `templates` - Resource creation templates
- `wizard` - Resource wizard system
- `auth` - Authentication and authorization
- `ui` - User interface components
- `api` - API routes and server endpoints
- `server` - Server-side utilities
- `db` - Database schema and queries
- `k8s` - Kubernetes integration
- `flux` - FluxCD resource handling
- `helm` - Helm chart

### Examples

```
feat(templates): add validation for GitRepository URL format

fix(auth): resolve session timeout handling for SSO users

docs: update README with new installation instructions

refactor(api): consolidate Flux resource API endpoints

chore: bump dependencies to latest versions

ci: add multi-arch Docker build workflow
```

### Footer for Co-Authors

If multiple people contributed to a commit:

```
feat(ui): add dark mode toggle

Implemented dark mode support across all components.

Co-Authored-By: Jane Doe <jane@example.com>
```

## Branch Naming Convention

Name your branch based on the type of change you're making:

```
<type>/<short-description>
```

### Branch Type Prefixes

Use the same type prefixes as commit messages:

- **feat/** - New features (`feat/add-oci-repository-support`)
- **fix/** - Bug fixes (`fix/session-timeout-issue`)
- **docs/** - Documentation changes (`docs/update-install-guide`)
- **refactor/** - Code refactoring (`refactor/flux-api-endpoints`)
- **chore/** - Maintenance tasks (`chore/update-dependencies`)
- **ci/** - CI/CD changes (`ci/add-multi-arch-build`)

### Examples

```bash
# Good branch names
git checkout -b feat/add-image-policy-validation
git checkout -b fix/websocket-reconnection-bug
git checkout -b docs/contributing-guide
git checkout -b refactor/simplify-k8s-client
git checkout -b chore/bump-tailwind-v4

# Bad branch names (avoid)
git checkout -b my-fix
git checkout -b update-stuff
git checkout -b branch-1
```

## Pull Request Process

1. **Create a branch** from `main` following the naming convention above:

   ```bash
   git checkout -b feat/your-feature-name
   ```

2. **Make your changes** following the code standards above

3. **Test your changes** (see [Testing](#testing) section)

4. **Run quality checks**:

   ```bash
   bun run check
   bun run lint
   ```

5. **Commit** using conventional commit format

6. **Push** your branch:

   ```bash
   git push origin feature/your-feature-name
   ```

7. **Open a Pull Request** on GitHub with:
   - Clear title following commit convention
   - Description of what changed and why
   - Any breaking changes noted
   - Screenshots for UI changes
   - Link to related issue(s) if applicable

8. **Wait for review** - maintainers will review and provide feedback

### PR Title Format

Follow the same convention as commits:

```
feat(templates): add support for OCIRepository resources
```

### PR Description Template

```markdown
## Summary

Brief description of the changes

## Changes

- Change 1
- Change 2
- Change 3

## Testing

How you tested these changes

## Screenshots (if applicable)

[Insert screenshots]

## Breaking Changes

None / List any breaking changes

## Related Issues

Fixes #123
```

## Testing

**Important**: This project currently does not have automated tests. All testing is manual.

### Before Submitting a PR

1. **Test in a real Kubernetes cluster** with FluxCD installed
2. **Test both success and error paths**
3. **Check browser console** for client-side errors
4. **Review server logs** for backend issues
5. **Test on different screen sizes** for UI changes

### Setting Up a Test Environment

```bash
# Create test cluster
kind create cluster --name gyre-test

# Install FluxCD
flux install

# Build and load image
docker build -t gyre:test .
kind load docker-image gyre:test --name gyre-test

# Install via Helm
helm install gyre charts/gyre -n flux-system \
  --set image.tag=test \
  --set image.pullPolicy=Never

# Port forward to test
kubectl port-forward -n flux-system svc/gyre 9999:80
```

### What to Test

- **Resource listing pages** load correctly
- **Resource detail pages** display all information
- **Resource creation wizard** works end-to-end
- **Actions** (suspend, resume, reconcile) function properly
- **Authentication** flows work (if applicable)
- **Real-time updates** appear via WebSocket/SSE

## Reporting Issues

### Bug Reports

When reporting bugs, please include:

1. **Gyre version** (from package.json or UI)
2. **Kubernetes version**: `kubectl version`
3. **FluxCD version**: `flux version`
4. **Browser** (if UI-related)
5. **Steps to reproduce**
6. **Expected behavior**
7. **Actual behavior**
8. **Screenshots** (if applicable)
9. **Logs**: Relevant pod logs or browser console output

### Feature Requests

When requesting features:

1. **Use case**: Why do you need this feature?
2. **Proposed solution**: How should it work?
3. **Alternatives**: What have you tried?
4. **Additional context**: Any other relevant information

## Adding New Features

### Adding a New FluxCD Resource Type

1. **Define types** in `src/lib/server/kubernetes/flux/types.ts`
2. **Add resource utilities** in `src/lib/server/kubernetes/flux/resources.ts`
3. **Create API routes** in `src/routes/api/flux/[resourceType]/`
4. **Add UI components** in `src/lib/components/flux/resources/`
5. **Update navigation** in `src/routes/+layout.svelte`
6. **Add resource template** in `src/lib/templates/index.ts`
7. **Update RBAC permissions** in `charts/gyre/templates/rbac.yaml`

### Database Schema Changes

1. Edit `src/lib/server/db/schema.ts`
2. Run `bun drizzle-kit generate` to create migration
3. Migrations auto-apply on app startup
4. Test with `bun drizzle-kit studio` locally

## Questions?

- Open an issue for questions not covered here
- Join discussions in existing issues and PRs

## Code of Conduct

Be respectful and constructive in all interactions. We welcome contributors of all experience levels and backgrounds.

---

Thank you for contributing to Gyre! 🎉
