#!/usr/bin/env bash
set -euo pipefail

KIND_CLUSTER="${KIND_CLUSTER:-gyre-demo}"
HELM_RELEASE="${HELM_RELEASE:-gyre}"
NAMESPACE="${NAMESPACE:-flux-system}"
PORT="${PORT:-3000}"
CHART_VERSION="${CHART_VERSION:-}"
ENCRYPTION_SECRET_NAME="${ENCRYPTION_SECRET_NAME:-gyre-encryption}"
METRICS_SECRET_NAME="${METRICS_SECRET_NAME:-gyre-metrics}"
ADMIN_SECRET_NAME="${ADMIN_SECRET_NAME:-gyre-initial-admin-secret}"

require_cmd() {
	local cmd="$1"
	if ! command -v "${cmd}" >/dev/null 2>&1; then
		echo "ERROR: required command not found: ${cmd}"
		exit 1
	fi
}

for cmd in kind kubectl flux helm openssl; do
	require_cmd "${cmd}"
done

echo "Starting Gyre local demo environment..."
echo "Cluster: ${KIND_CLUSTER}"
echo "Release: ${HELM_RELEASE}"
echo "Namespace: ${NAMESPACE}"
echo ""

if kind get clusters | grep -Fxq "${KIND_CLUSTER}"; then
	echo "Kind cluster '${KIND_CLUSTER}' already exists."
else
	echo "Creating kind cluster '${KIND_CLUSTER}'..."
	kind create cluster --name "${KIND_CLUSTER}"
fi

echo "Installing FluxCD (idempotent)..."
flux install

echo "Ensuring namespace exists..."
kubectl get namespace "${NAMESPACE}" >/dev/null 2>&1 || kubectl create namespace "${NAMESPACE}"

GYRE_ENCRYPTION_KEY="${GYRE_ENCRYPTION_KEY:-$(openssl rand -hex 32)}"
AUTH_ENCRYPTION_KEY="${AUTH_ENCRYPTION_KEY:-$(openssl rand -hex 32)}"
BACKUP_ENCRYPTION_KEY="${BACKUP_ENCRYPTION_KEY:-$(openssl rand -hex 32)}"
GYRE_METRICS_TOKEN="${GYRE_METRICS_TOKEN:-$(openssl rand -hex 32)}"

echo "Creating/updating required chart secrets..."
kubectl create secret generic "${ENCRYPTION_SECRET_NAME}" \
	-n "${NAMESPACE}" \
	--from-literal=GYRE_ENCRYPTION_KEY="${GYRE_ENCRYPTION_KEY}" \
	--from-literal=AUTH_ENCRYPTION_KEY="${AUTH_ENCRYPTION_KEY}" \
	--from-literal=BACKUP_ENCRYPTION_KEY="${BACKUP_ENCRYPTION_KEY}" \
	--dry-run=client -o yaml | kubectl apply -f -

kubectl create secret generic "${METRICS_SECRET_NAME}" \
	-n "${NAMESPACE}" \
	--from-literal=GYRE_METRICS_TOKEN="${GYRE_METRICS_TOKEN}" \
	--dry-run=client -o yaml | kubectl apply -f -

echo "Installing Gyre via Helm..."
helm_args=(
	upgrade --install "${HELM_RELEASE}" "oci://ghcr.io/entropy0120/charts/gyre"
	--namespace "${NAMESPACE}"
	--create-namespace
	--wait
	--set "encryption.existingSecret=${ENCRYPTION_SECRET_NAME}"
	--set "metrics.existingSecret=${METRICS_SECRET_NAME}"
)
if [ -n "${CHART_VERSION}" ]; then
	helm_args+=(--version "${CHART_VERSION}")
fi
helm "${helm_args[@]}"

echo ""
echo "Gyre is installed and ready."
if PASSWORD="$(kubectl get secret "${ADMIN_SECRET_NAME}" -n "${NAMESPACE}" -o jsonpath='{.data.password}' 2>/dev/null | base64 -d)"; then
	if [ -n "${PASSWORD}" ]; then
		echo "Username: admin"
		echo "Password: ${PASSWORD}"
	fi
fi
echo ""
echo "Access the UI:"
echo "  kubectl port-forward -n ${NAMESPACE} svc/${HELM_RELEASE} ${PORT}:80"
echo "  http://localhost:${PORT}"
