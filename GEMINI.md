# Gyre - Instructional Context

Gyre is a modern, real-time WebUI for **FluxCD**, designed to manage multiple Kubernetes clusters with built-in RBAC and SSO support.

> **Note**: This file provides architectural and procedural guidance for AI agents working on this project. For the official project documentation, please refer to:
> **[entropy0120.github.io/gyre](https://entropy0120.github.io/gyre/)**

## 🛠 Tech Stack

- **Runtime:** [Bun](https://bun.sh)
- **Framework:** [Svelte 5](https://svelte.dev) + [SvelteKit](https://kit.svelte.dev)
- **Styling:** TailwindCSS v4 + shadcn-svelte
- **Database:** SQLite with [Drizzle ORM](https://orm.drizzle.team)
- **Kubernetes:** Native client with multi-cluster context support
- **Real-time:** SSE via background polling worker

## 🏗 Architecture & Project Structure

Detailed information about the system design and component organization can be found in the **[Architecture Guide](https://entropy0120.github.io/gyre/architecture)**.

## 📜 Development Conventions

Comprehensive coding standards, development workflows, and implementation details are available in the **[Development Guide](https://entropy0120.github.io/gyre/development)**.

### Key Mandates:
1. **Svelte 5 Runes**: Always use `$state`, `$derived`, `$effect`, `$props`.
2. **Multi-Cluster**: Respect `locals.cluster` context in all API/K8s calls.
3. **Security**: Enforce RBAC using `checkPermission` or `requirePermission`.
4. **Consistency**: Follow existing patterns for resource handling and API responses.

## 🚀 Common Commands

- `bun run dev` - Start dev server
- `bun run check` - Type-check
- `bun run lint` - Lint and format check
- `bun run format` - Format code

For a complete command reference, see the **[Development Guide](https://entropy0120.github.io/gyre/development)**.
