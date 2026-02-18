---
sidebar_position: 6
---

# Contributing

Thank you for your interest in contributing to Gyre! This document outlines the standards and processes for contributing to this project.

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

```text
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

3. **In-Cluster Only**: Gyre is designed to run inside Kubernetes clusters only for production. However, local development is supported by using a local `~/.kube/config` as detailed in the [Development Guide](./development.md).

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

```text
<type>(<scope>): <description>

[optional body]

[optional footer(s)]
```

### Types

- **feat**: A new feature
- **fix**: A bug fix
- **docs**: Documentation-only changes
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

```text
feat(templates): add validation for GitRepository URL format

fix(auth): resolve session timeout handling for SSO users

docs: update README with new installation instructions

refactor(api): consolidate Flux resource API endpoints

chore: bump dependencies to latest versions

ci: add multi-arch Docker build workflow
```

### Footer for Co-Authors

If multiple people contributed to a commit:

```text
feat(ui): add dark mode toggle

Implemented dark mode support across all components.

Co-Authored-By: Jane Doe <jane@example.com>
```

## Branch Naming Convention

Name your branch based on the type of change you're making:

```text
<type>/<short-description>
```

### Branch Type Prefixes

Use the same type prefixes as commit messages:

- **feat/** - New features
- **fix/** - Bug fixes
- **docs/** - Documentation changes
- **refactor/** - Code refactoring
- **chore/** - Maintenance tasks
- **ci/** - CI/CD changes

## Pull Request Process

1. **Create a branch** from `main` following the naming convention above.
2. **Make your changes** following the code standards.
3. **Test your changes** manually in a cluster.
4. **Run quality checks** (`bun run check`, `bun run lint`).
5. **Commit** using conventional commit format.
6. **Push** your branch and open a Pull Request.

## Testing

**Important**: This project currently does not have automated tests. All testing is manual.

### Before Submitting a PR

1. **Test in a real Kubernetes cluster** with FluxCD installed.
2. **Test both success and error paths**.
3. **Check browser console** for client-side errors.
4. **Review server logs** for backend issues.
5. **Test on different screen sizes** for UI changes.

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

## Reporting Issues

When reporting bugs, please include:

1. **Gyre version**
2. **Kubernetes version**
3. **FluxCD version**
4. **Steps to reproduce**
5. **Expected vs Actual behavior**
6. **Screenshots & Logs**

## Adding New Features

### Adding a New FluxCD Resource Type

1. **Define types** in `src/lib/server/kubernetes/flux/types.ts`.
2. **Add resource utilities** in `src/lib/server/kubernetes/flux/resources.ts`.
3. **Create API routes** in `src/routes/api/flux/[resourceType]/`.
4. **Add UI components** in `src/lib/components/flux/resources/`.
5. **Update navigation** in `src/routes/+layout.svelte`.
6. **Add resource template** in `src/lib/templates/index.ts`.
7. **Update RBAC permissions** in `charts/gyre/templates/rbac.yaml`.

## License

By contributing, you agree that your contributions will be licensed under the MIT License.
