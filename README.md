# Gyre

**A Modern Dashboard for FluxCD.**

Gyre is a standalone dashboard for managing multi-cluster FluxCD environments. Built with **Svelte 5** and **Bun**, it offers a high-performance, single-binary experience.

## ✨ Key Features

- **🌐 Multi-Cluster Management**: Seamlessly switch between Kubernetes contexts directly from the header.
- **🎨 Modern Dark Theme**: A deep zinc and gold industrial design with a clean, responsive UI.
- **⚡ Svelte 5 Reactivity**: Built on the bleeding edge of web tech with runes (`$state`, `$derived`) for instant state updates.
- **🔌 Zero-Config**: Binaries run anywhere. No database, no agents, no CRDs required. It just talks to your Kubeconfig.
- **📊 Live Status**: Real-time "glowing" status indicators and live reconciliation feedback.
- **🚀 Instant Actions**: Trigger reconciliations, suspend/resume resources, and debug manifests with a single click.

## 🛠️ Tech Stack

- **Runtime**: [Bun](https://bun.sh) (v1.x)
- **Framework**: SvelteKit + Svelte 5 (Runes)
- **Styling**: TailwindCSS v4 + Shadcn-Svelte
- **State**: Persistent Stores (Cookies + Runes)
- **API**: Native Kubernetes Client (No intermediary proxies)

## 🚀 Getting Started

### Prerequisites

- [Bun](https://bun.sh) installed.
- Access to a Kubernetes cluster with FluxCD.
- A valid `~/.kube/config`.

### Development

```bash
# Install dependencies
bun install

# Start the dev server (with hot reload)
bun run dev --open
```

### Production Build

Gyre compiles to a standalone, hassle-free binary.

```bash
# 1. Build the app
bun run build

# 2. Compile to single binary
bun build --compile --minify ./build/index.js --outfile gyre

# 3. Run it!
./gyre
```

## 🏗️ Architecture

Gyre runs entirely locally or in a pod, acting as a direct interface to the Kubernetes API.

```mermaid
graph LR
    User[User / Ops] -->|HTTPS| Gyre[Gyre Binary]
    Gyre -->|K8s API| Cluster1[Cluster A (Dev)]
    Gyre -->|K8s API| Cluster2[Cluster B (Prod)]
    
    subgraph Gyre Internal
        UI[Svelte 5 UI] <--SSR--> API[Server Actions]
    end
```

## 📜 License

MIT License. Built with ❤️ by [10xdev].
