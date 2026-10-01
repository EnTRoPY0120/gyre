---
sidebar_position: 7
---

# Development

Gyre is a SvelteKit application backed by SQLite and Kubernetes APIs. Production runs in-cluster through Helm or Flux. Local out-of-cluster mode is for development and testing.

## Set up

The Dev Container is the recommended environment. In VS Code, open the repository in the Dev Containers extension and choose **Dev Containers: Reopen in Container**. It installs Node.js 26, pnpm 11.1.0, and Kubernetes tools.

Start the app in the container:

```sh
pnpm dev
```

For a manual setup, install Node.js 22.13 or later and pnpm 11.1.0:

```sh
pnpm install
pnpm dev
```

The app listens on port 3000. The Dev Container mounts the host kubeconfig read-only; use an existing Flux cluster or create a local one with `kind` and `flux`.

## Quality checks

```sh
pnpm verify:ci       # App formatting, lint, types, tests, and build
pnpm verify:repo:ci  # Full app, docs, Helm, and shell-script gate
pnpm docs:check      # Typecheck and build the Docusaurus site
pnpm helm:check      # Lint the Helm chart
pnpm scripts:check   # Check shell syntax
```

`pnpm verify:repo:ci` is the full CI gate. `pnpm verify` formats files before checking; use the `:ci` commands for non-mutating checks.

Fallow reports code health separately from required checks. The checked-in [`health/fallow-baseline.json`](https://github.com/entropy0120/gyre/blob/main/health/fallow-baseline.json) tracks existing findings; `pnpm fallow:health:baseline` reports changes from that baseline. `pnpm fallow:health:coverage` runs coverage instrumentation and may take longer than the regular test suite.

## Local cluster helpers

```sh
./scripts/demo.sh          # Create a local kind cluster, install Flux and Gyre
./scripts/redeploy-kind.sh # Rebuild and redeploy to an existing kind cluster
```

See [Installation](./installation/index.md) for published Helm/GitOps installs, the Docker-connected local mode, and production access. See [Troubleshooting](./troubleshooting.md) for runtime recovery steps.

## Data and migrations

Development data is stored in `./data/gyre.db`; the container uses `/data/gyre.db`.

```sh
pnpm drizzle-kit generate # Generate migrations after schema changes
pnpm drizzle-kit migrate  # Apply migrations locally
pnpm drizzle-kit studio   # Open the database browser
```

Production runs migrations on startup. Review generated migrations before committing them.

## Documentation site

The Docusaurus site lives in `documentation/`. Its local editing and deployment instructions are in `documentation/README.md`. Run `pnpm docs:check` before submitting documentation changes.

## Release notes

Releases are triggered by pushing a version tag. Update the package version and release-facing docs, commit the change, then create and push the tag. Chart metadata intentionally uses placeholder versions; CI injects the release version when packaging.

```sh
git tag -a vX.Y.Z -m "Release vX.Y.Z"
git push origin vX.Y.Z
```

## Conventions

- Use Svelte 5 runes (`$state`, `$derived`, `$effect`, `$props`), not legacy Svelte syntax.
- Keep server-only code in `src/lib/server/`; components should access it through SvelteKit loads or routes.
- Use TailwindCSS v4 utilities and existing shared components.

See [Contributing](./contributing.md) for route-scoped Kubernetes and permission handling, API authorization, and safe logging conventions.
