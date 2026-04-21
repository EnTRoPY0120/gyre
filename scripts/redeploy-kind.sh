#!/usr/bin/env bash
set -euo pipefail

IMAGE_NAME="${IMAGE_NAME:-gyre}"
IMAGE_TAG="${IMAGE_TAG:-dev}"
KIND_CLUSTER="${KIND_CLUSTER:-gyre-test}"
KIND_CONTEXT="kind-${KIND_CLUSTER}"
HELM_RELEASE="${HELM_RELEASE:-gyre}"
NAMESPACE="${NAMESPACE:-flux-system}"
PORT="${PORT:-9999}"
BIND_ADDR="${BIND_ADDR:-127.0.0.1}"
ENCRYPTION_SECRET_NAME="${ENCRYPTION_SECRET_NAME:-gyre-encryption}"
METRICS_SECRET_NAME="${METRICS_SECRET_NAME:-gyre-metrics}"
ADMIN_SECRET_NAME="${ADMIN_SECRET_NAME:-gyre-initial-admin-secret}"
FORCE_ROTATE_METRICS_TOKEN="${FORCE_ROTATE_METRICS_TOKEN:-false}"

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

read_secret_value() {
	local secret_name="$1"
	local key="$2"
	local encoded_value

	if ! encoded_value="$(kubectl get secret "${secret_name}" -n "${NAMESPACE}" -o "jsonpath={.data.${key}}" 2>/dev/null)"; then
		return 1
	fi
	if [ -z "${encoded_value}" ]; then
		return 1
	fi
	printf '%s' "${encoded_value}" | base64 -d 2>/dev/null
}

validate_hex_256_key() {
	local var_name="$1"
	local value="$2"
	if ! [[ "${value}" =~ ^[0-9a-fA-F]{64}$ ]]; then
		echo "ERROR: ${var_name} must be 64 hexadecimal characters (^[0-9a-fA-F]{64}$)."
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

if ! kubectl config get-contexts "${KIND_CONTEXT}" >/dev/null 2>&1; then
	echo "ERROR: kube context '${KIND_CONTEXT}' not found."
	echo "Ensure kind cluster '${KIND_CLUSTER}' is configured in kubeconfig."
	exit 1
fi
kubectl config use-context "${KIND_CONTEXT}" >/dev/null
if [ "$(kubectl config current-context 2>/dev/null || true)" != "${KIND_CONTEXT}" ]; then
	echo "ERROR: failed to switch kubectl context to '${KIND_CONTEXT}'."
	exit 1
fi

echo "=================================================="
echo "Gyre Kind Redeploy"
echo "=================================================="
echo "Image:       ${IMAGE_NAME}:${IMAGE_TAG}"
echo "Cluster:     ${KIND_CLUSTER}"
echo "Release:     ${HELM_RELEASE}"
echo "Namespace:   ${NAMESPACE}"
echo "Port:        ${PORT}"
echo "Bind addr:   ${BIND_ADDR}"
echo "Enc secret:  ${ENCRYPTION_SECRET_NAME}"
echo "Metrics sec: ${METRICS_SECRET_NAME}"
echo "Note: If '${ENCRYPTION_SECRET_NAME}' is missing and keys are not pre-exported,"
echo "      new encryption keys are generated and existing encrypted data cannot be recovered."
echo ""

echo "Building image..."
docker build -t "${IMAGE_NAME}:${IMAGE_TAG}" .

echo "Loading image into kind cluster..."
kind load docker-image "${IMAGE_NAME}:${IMAGE_TAG}" --name "${KIND_CLUSTER}"

echo "Ensuring namespace exists..."
kubectl get namespace "${NAMESPACE}" >/dev/null 2>&1 || kubectl create namespace "${NAMESPACE}"

echo "Ensuring required secrets..."
if kubectl get secret "${ENCRYPTION_SECRET_NAME}" -n "${NAMESPACE}" >/dev/null 2>&1; then
	echo "Using existing encryption keys from '${ENCRYPTION_SECRET_NAME}'."
	for key in GYRE_ENCRYPTION_KEY AUTH_ENCRYPTION_KEY BACKUP_ENCRYPTION_KEY; do
		if ! value="$(read_secret_value "${ENCRYPTION_SECRET_NAME}" "${key}")"; then
			echo "ERROR: missing '${key}' in secret '${ENCRYPTION_SECRET_NAME}'."
			echo "Refusing to generate replacement keys automatically to avoid data loss."
			exit 1
		fi
		validate_hex_256_key "${key}" "${value}"
		printf -v "${key}" '%s' "${value}"
		export "${key?}"
	done
else
	echo "Encryption secret '${ENCRYPTION_SECRET_NAME}' not found; creating it."
	GYRE_ENCRYPTION_KEY="${GYRE_ENCRYPTION_KEY:-$(openssl rand -hex 32)}"
	AUTH_ENCRYPTION_KEY="${AUTH_ENCRYPTION_KEY:-$(openssl rand -hex 32)}"
	BACKUP_ENCRYPTION_KEY="${BACKUP_ENCRYPTION_KEY:-$(openssl rand -hex 32)}"
	for key in GYRE_ENCRYPTION_KEY AUTH_ENCRYPTION_KEY BACKUP_ENCRYPTION_KEY; do
		validate_hex_256_key "${key}" "${!key}"
	done
	export GYRE_ENCRYPTION_KEY AUTH_ENCRYPTION_KEY BACKUP_ENCRYPTION_KEY
	kubectl create secret generic "${ENCRYPTION_SECRET_NAME}" \
		-n "${NAMESPACE}" \
		--from-literal=GYRE_ENCRYPTION_KEY="${GYRE_ENCRYPTION_KEY}" \
		--from-literal=AUTH_ENCRYPTION_KEY="${AUTH_ENCRYPTION_KEY}" \
		--from-literal=BACKUP_ENCRYPTION_KEY="${BACKUP_ENCRYPTION_KEY}" \
		--dry-run=client -o yaml | kubectl apply -f -
fi

if [ "${FORCE_ROTATE_METRICS_TOKEN}" = "true" ]; then
	echo "FORCE_ROTATE_METRICS_TOKEN=true; generating new metrics token."
	GYRE_METRICS_TOKEN="$(openssl rand -hex 32)"
elif value="$(read_secret_value "${METRICS_SECRET_NAME}" "GYRE_METRICS_TOKEN")"; then
	GYRE_METRICS_TOKEN="${value}"
	echo "Using existing metrics token from '${METRICS_SECRET_NAME}'."
else
	GYRE_METRICS_TOKEN="${GYRE_METRICS_TOKEN:-$(openssl rand -hex 32)}"
	echo "Metrics token not found in '${METRICS_SECRET_NAME}'; generating a new token."
fi
export GYRE_METRICS_TOKEN

kubectl create secret generic "${METRICS_SECRET_NAME}" \
	-n "${NAMESPACE}" \
	--from-literal=GYRE_METRICS_TOKEN="${GYRE_METRICS_TOKEN}" \
	--dry-run=client -o yaml | kubectl apply -f -

echo "Upgrading/installing Helm release..."
REDEPLOY_MARKER="${REDEPLOY_MARKER:-$(date -u +%Y%m%d%H%M%S)}"
helm upgrade --install "${HELM_RELEASE}" ./charts/gyre \
	--namespace "${NAMESPACE}" \
	--create-namespace \
	--wait \
	--set image.repository="${IMAGE_NAME}" \
	--set image.tag="${IMAGE_TAG}" \
	--set image.pullPolicy=IfNotPresent \
	--set encryption.existingSecret="${ENCRYPTION_SECRET_NAME}" \
	--set metrics.existingSecret="${METRICS_SECRET_NAME}" \
	--set admin.secretName="${ADMIN_SECRET_NAME}" \
	--set-string podAnnotations.gyre\\.redeployTimestamp="${REDEPLOY_MARKER}"

echo ""
echo "Deployment complete."
echo ""
if ADMIN_PASSWORD="$(kubectl get secret "${ADMIN_SECRET_NAME}" -n "${NAMESPACE}" -o jsonpath='{.data.password}' 2>/dev/null | base64 -d)"; then
	if [ -n "${ADMIN_PASSWORD}" ]; then
		echo "Admin credentials:"
		echo "  Username: admin"
		if [ -t 1 ]; then
			echo "  Password: ${ADMIN_PASSWORD}"
		else
			echo "  Password: hidden (shown only for interactive local runs)."
		fi
		echo ""
	fi
fi

echo "Access Gyre:"
echo "  1) kubectl port-forward -n ${NAMESPACE} svc/${HELM_RELEASE} ${PORT}:80 --address ${BIND_ADDR}"
echo "  2) open http://localhost:${PORT}"
