---
sidebar_position: 6
---

# Contributing

Thanks for helping improve Gyre. See the [Development Guide](./development.md) for environment setup and the repository's quality commands.

## Before opening a pull request

- Explain the behavior you changed and why.
- Run `pnpm verify:repo:ci` for the full repository check, or explain which focused checks you ran.
- Test Kubernetes-dependent behavior against a cluster with Flux when the change affects that integration.
- Include reproduction steps for bug fixes and screenshots for visible UI changes when they help review.

Write automated tests for observable behavior, security boundaries, and regressions that would be costly to miss. Prefer a test at the narrowest useful boundary, including real DOM behavior for browser interactions. Avoid tests that duplicate implementation details, assert trivial forwarding, or add cases without a distinct failure they would catch. Use manual cluster testing for behavior that a unit or route test cannot represent.

## Code conventions

- Use TypeScript and Svelte 5 runes (`$state`, `$derived`, `$effect`, `$props`).
- Keep server-only code in `src/lib/server/`; UI components should call server behavior through SvelteKit load functions or routes.
- Use TailwindCSS v4 utilities and the existing UI components and theme.
- Follow nearby naming and formatting patterns. Prefer an existing shared helper or component when it already represents the behavior.
- Pass the request's `locals.cluster` through Kubernetes and permission checks. Do not switch a process-wide kubeconfig to serve a request.
- API handlers must authenticate the caller and check access to the requested cluster, namespace, and action.
- Log errors with the server logger's error-first form; never include credentials, tokens, or private resource data in logs.

## Commit and pull request

Use a Conventional Commit subject, for example `fix(auth): handle expired sessions`. Keep the pull request focused and describe the user-visible result, relevant implementation choice, and verification performed.

Open an issue or discussion before a broad feature or behavior change that needs agreement. Bug reports should include the Gyre version, Kubernetes and Flux versions when relevant, steps to reproduce, and expected versus actual behavior. Remove secrets and sensitive resource data from logs or screenshots.

## Extending resource support

Adding a Flux resource type can affect the resource type definitions, server API, resource detail UI, creation templates, navigation, and Helm RBAC. Follow the existing resource path end to end and update the user guide and tests for the supported behavior.

Contributions are distributed under the [MIT License](https://github.com/entropy0120/gyre/blob/main/LICENSE).
