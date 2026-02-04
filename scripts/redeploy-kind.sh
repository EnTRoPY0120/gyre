#!/bin/bash
set -e # Exit on error

# Configuration
IMAGE_NAME="gyre"
IMAGE_TAG="v0.1.0-test"
KIND_CLUSTER="gyre-test"
HELM_RELEASE="gyre"
NAMESPACE="flux-system"

echo "=================================================="
echo "  Gyre - Kind Redeploy Script"
echo "=================================================="
echo ""

# Step 1: Build Docker image
echo "📦 Building Docker image: ${IMAGE_NAME}:${IMAGE_TAG}"
docker build -t ${IMAGE_NAME}:${IMAGE_TAG} .
echo "✓ Image built successfully"
echo ""

# Step 2: Load image into kind cluster
echo "📥 Loading image into kind cluster: ${KIND_CLUSTER}"
kind load docker-image ${IMAGE_NAME}:${IMAGE_TAG} --name ${KIND_CLUSTER}
echo "✓ Image loaded into kind cluster"
echo ""

# Step 3: Uninstall Helm chart
echo "🗑️  Uninstalling Helm release: ${HELM_RELEASE}"
if helm uninstall ${HELM_RELEASE} -n ${NAMESPACE} 2>/dev/null; then
  echo "✓ Helm release uninstalled"
else
  echo "⚠️  Helm release not found or already uninstalled"
fi
echo ""

# Step 4: Wait for cleanup
echo "⏳ Waiting 5 seconds for cleanup..."
sleep 5
echo "✓ Cleanup complete"
echo ""

# Step 5: Install Helm chart
echo "📦 Installing Helm chart: ${HELM_RELEASE}"
helm install ${HELM_RELEASE} ./charts/gyre \
  --namespace ${NAMESPACE} \
  --set image.repository=${IMAGE_NAME} \
  --set image.tag=${IMAGE_TAG} \
  --set image.pullPolicy=IfNotPresent
echo "✓ Helm chart installed"
echo ""

# Step 6: Wait for pod to be ready
echo "⏳ Waiting for pod to be ready..."
kubectl wait --for=condition=ready pod \
  -l app.kubernetes.io/name=gyre \
  -n ${NAMESPACE} \
  --timeout=120s
echo "✓ Pod is ready"
echo ""

# Step 7: Get admin password
echo "=================================================="
echo "  Deployment Complete!"
echo "=================================================="
echo ""
echo "🔑 Retrieving admin password..."
ADMIN_PASSWORD=$(kubectl get secret gyre-initial-admin-secret -n ${NAMESPACE} -o jsonpath='{.data.password}' 2>/dev/null | base64 -d)
if [ -n "$ADMIN_PASSWORD" ]; then
  echo ""
  echo "   Username: admin"
  echo "   Password: ${ADMIN_PASSWORD}"
  echo ""
else
  echo "   ⚠️  Could not retrieve password. Check manually with:"
  echo "   kubectl get secret gyre-initial-admin-secret -n ${NAMESPACE} -o jsonpath='{.data.password}' | base64 -d"
  echo ""
fi

kubectl port-forward -n flux-system svc/gyre 9999:80 --address 0.0.0.0

# Step 8: Show access information
echo "=================================================="
echo "  Access Information"
echo "=================================================="
echo ""
echo "  http://localhost:9999"
echo ""
echo "=================================================="
echo ""

# Step 9: Show pod logs (last 20 lines)
echo "📋 Recent pod logs:"
echo "=================================================="
kubectl logs -n ${NAMESPACE} -l app.kubernetes.io/name=gyre --tail=20 --prefix=false
echo "=================================================="
echo ""
echo "✅ Redeploy complete!"
