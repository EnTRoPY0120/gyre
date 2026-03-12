#!/bin/bash
set -e

echo "🚀 Starting Gyre Local Demo Environment..."

# Check dependencies
for cmd in kind kubectl flux helm; do
  if ! command -v $cmd &> /dev/null; then
    echo "❌ $cmd is required but not installed. Please install it first."
    exit 1
  fi
done

echo "📦 Creating kind cluster 'gyre-demo'..."
if kind get clusters | grep -q "gyre-demo"; then
  echo "Cluster 'gyre-demo' already exists."
else
  kind create cluster --name gyre-demo
fi

echo "🔧 Installing FluxCD..."
flux install

echo "⛵ Installing Gyre via Helm..."
helm repo add gyre https://entropy0120.github.io/gyre
helm repo update
helm upgrade --install gyre gyre/gyre \
  --namespace flux-system \
  --create-namespace \
  --wait

echo "⏳ Waiting for Gyre to be ready..."
kubectl wait --for=condition=available deployment/gyre -n flux-system --timeout=120s

echo "🔐 Fetching Admin Password..."
PASSWORD=$(kubectl get secret gyre-initial-admin-secret -n flux-system -o jsonpath='{.data.password}' | base64 -d)

echo ""
echo "✅ Gyre is installed and ready!"
echo "-----------------------------------"
echo "👤 Username: admin"
echo "🔑 Password: $PASSWORD"
echo "-----------------------------------"
echo ""
echo "🌐 To access the UI, run this command in a new terminal:"
echo "kubectl port-forward -n flux-system svc/gyre 3000:80"
echo ""
echo "Then visit: http://localhost:3000"
