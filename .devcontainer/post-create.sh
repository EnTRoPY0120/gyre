#!/bin/bash
set -e

echo "Running Gyre devcontainer post-create setup..."

# Install dependencies
bun install

# Run type check
bun run check

echo ""
echo "=============================================="
echo "Devcontainer setup complete!"
echo "=============================================="
echo ""
echo "Optional: Create a local kind cluster with FluxCD"
echo ""
echo "  # Create kind cluster (requires Docker)"
echo "  kind create cluster"
echo ""
echo "  # Install FluxCD"
echo "  flux install"
echo ""
echo "  # Verify FluxCD is running"
echo "  kubectl get pods -n flux-system"
echo ""
echo "Start Gyre development server:"
echo "  bun run dev"
echo ""
echo "Access Gyre at: http://localhost:3000"
echo "=============================================="
