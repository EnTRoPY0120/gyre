#!/usr/bin/env bash
set -euo pipefail

IMAGE_NAME="${IMAGE_NAME:-gyre}"
IMAGE_TAG="${IMAGE_TAG:-dev}"
KIND_CLUSTER="${KIND_CLUSTER:-gyre-test}"
HELM_RELEASE="${HELM_RELEASE:-gyre}"
NAMESPACE="${NAMESPACE:-flux-system}"
PORT="${PORT:-9999}"
ENCRYPTION_SECRET_NAME="${ENCRYPTION_SECRET_NAME:-gyre-encryption}"
METRICS_SECRET_NAME="${METRICS_SECRET_NAME:-gyre-metrics}"
ADMIN_SECRET_NAME="${ADMIN_SECRET_NAME:-gyre-initial-admin-secret}"

on_error() {
	local line="$1"
	echo ""
	echo "ERROR: redeploy-kind.sh failed at line ${line}: ${BASH_COMMAND}"
	echo "Next steps:"
	echo "  - Check pods: kubectl get pods -n ${NAMESPACE}"
	echo "  - Check events: kubectl get events -n ${NAMESPACE} --sort-by=.lastTimestamp | tail -n 20"
	echo "  - Check Helm release: helm status ${HELM_RELEASE} -n ${NAMESPACE}"
}
trap 'on_error $LINENO' ERR

require_cmd() {
	local cmd="$1"
	if ! command -v "${cmd}" >/dev/null 2>&1; then
		echo "ERROR: required command not found: ${cmd}"
		exit 1
	fi
}

for cmd in docker kind kubectl helm openssl; do
	require_cmd "${cmd}"
done

if ! kind get clusters | grep -Fxq "${KIND_CLUSTER}"; then
	echo "ERROR: kind cluster '${KIND_CLUSTER}' does not exist."
	echo "Create it first with: kind create cluster --name ${KIND_CLUSTER}"
	exit 1
fi

GYRE_ENCRYPTION_KEY="${GYRE_ENCRYPTION_KEY:-$(openssl rand -hex 32)}"
AUTH_ENCRYPTION_KEY="${AUTH_ENCRYPTION_KEY:-$(openssl rand -hex 32)}"
BACKUP_ENCRYPTION_KEY="${BACKUP_ENCRYPTION_KEY:-$(openssl rand -hex 32)}"
GYRE_METRICS_TOKEN="${GYRE_METRICS_TOKEN:-$(openssl rand -hex 32)}"

echo "=================================================="
echo "Gyre Kind Redeploy"
echo "=================================================="
echo "Image:       ${IMAGE_NAME}:${IMAGE_TAG}"
echo "Cluster:     ${KIND_CLUSTER}"
echo "Release:     ${HELM_RELEASE}"
echo "Namespace:   ${NAMESPACE}"
echo "Port:        ${PORT}"
echo "Enc secret:  ${ENCRYPTION_SECRET_NAME}"
echo "Metrics sec: ${METRICS_SECRET_NAME}"
echo ""

echo "Building image..."
docker build -t "${IMAGE_NAME}:${IMAGE_TAG}" .

echo "Loading image into kind cluster..."
kind load docker-image "${IMAGE_NAME}:${IMAGE_TAG}" --name "${KIND_CLUSTER}"

echo "Ensuring namespace exists..."
kubectl get namespace "${NAMESPACE}" >/dev/null 2>&1 || kubectl create namespace "${NAMESPACE}"

echo "Creating/updating required secrets..."
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

echo "Upgrading/installing Helm release..."
helm upgrade --install "${HELM_RELEASE}" ./charts/gyre \
	--namespace "${NAMESPACE}" \
	--create-namespace \
	--wait \
	--set image.repository="${IMAGE_NAME}" \
	--set image.tag="${IMAGE_TAG}" \
	--set image.pullPolicy=IfNotPresent \
	--set encryption.existingSecret="${ENCRYPTION_SECRET_NAME}" \
	--set metrics.existingSecret="${METRICS_SECRET_NAME}"

echo ""
echo "Deployment complete."
echo ""
if ADMIN_PASSWORD="$(kubectl get secret "${ADMIN_SECRET_NAME}" -n "${NAMESPACE}" -o jsonpath='{.data.password}' 2>/dev/null | base64 -d)"; then
	if [ -n "${ADMIN_PASSWORD}" ]; then
		echo "Admin credentials:"
		echo "  Username: admin"
		echo "  Password: ${ADMIN_PASSWORD}"
		echo ""
	fi
fi

echo "Access Gyre:"
echo "  1) kubectl port-forward -n ${NAMESPACE} svc/${HELM_RELEASE} ${PORT}:80 --address 0.0.0.0"
echo "  2) open http://localhost:${PORT}"
