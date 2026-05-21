#!/usr/bin/env bash
set -euo pipefail

echo "Node: $(node --version)"
echo "pnpm: $(pnpm --version)"

node -e "const [major, minor] = process.versions.node.split('.').map(Number); if (major < 22 || (major === 22 && minor < 13)) { throw new Error('Node.js >=22.13 is required'); }"
test "$(pnpm --version)" = "11.1.0"

if command -v kubectl >/dev/null 2>&1; then
	kubectl version --client=true
else
	echo "kubectl: not installed"
fi

if command -v helm >/dev/null 2>&1; then
	helm version --short
else
	echo "helm: not installed"
fi

if command -v kind >/dev/null 2>&1; then
	kind version
else
	echo "kind: not installed"
fi

if command -v flux >/dev/null 2>&1; then
	flux --version
else
	echo "flux: not installed"
fi

pnpm install --frozen-lockfile

# Optional local cluster setup, run manually only when needed:
# kind create cluster --name gyre
# flux install
