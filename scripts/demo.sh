#!/usr/bin/env bash
set -euo pipefail

KIND_CLUSTER="${KIND_CLUSTER:-gyre-demo}"
KIND_CONTEXT="kind-${KIND_CLUSTER}"
HELM_RELEASE="${HELM_RELEASE:-gyre}"
NAMESPACE="${NAMESPACE:-flux-system}"
PORT="${PORT:-3000}"
CHART_VERSION="${CHART_VERSION:-}"
HELM_TIMEOUT="${HELM_TIMEOUT:-10m}"
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

if ! kubectl config get-contexts "${KIND_CONTEXT}" >/dev/null 2>&1; then
	echo "ERROR: kube context '${KIND_CONTEXT}' not found."
	echo "Ensure kind created cluster '${KIND_CLUSTER}' and kubeconfig is available."
	exit 1
fi
kubectl config use-context "${KIND_CONTEXT}" >/dev/null
if [ "$(kubectl config current-context 2>/dev/null || true)" != "${KIND_CONTEXT}" ]; then
	echo "ERROR: failed to switch kubectl context to '${KIND_CONTEXT}'."
	exit 1
fi
echo "Using kube context '${KIND_CONTEXT}'."

echo "Installing FluxCD (idempotent)..."
flux install

echo "Ensuring namespace exists..."
kubectl get namespace "${NAMESPACE}" >/dev/null 2>&1 || kubectl create namespace "${NAMESPACE}"

echo "Ensuring required chart secrets..."
encryption_secret_exists=false
if kubectl get secret "${ENCRYPTION_SECRET_NAME}" -n "${NAMESPACE}" >/dev/null 2>&1; then
	encryption_secret_exists=true
fi

encryption_missing_keys=()
for key in GYRE_ENCRYPTION_KEY AUTH_ENCRYPTION_KEY BACKUP_ENCRYPTION_KEY; do
	if value="$(read_secret_value "${ENCRYPTION_SECRET_NAME}" "${key}")"; then
		printf -v "${key}" '%s' "${value}"
	else
		if [ -n "${!key:-}" ]; then
			value="${!key}"
		else
			value="$(openssl rand -hex 32)"
		fi
		printf -v "${key}" '%s' "${value}"
		encryption_missing_keys+=("${key}")
	fi
done

if ! ${encryption_secret_exists}; then
	echo "Creating encryption secret '${ENCRYPTION_SECRET_NAME}'..."
	kubectl create secret generic "${ENCRYPTION_SECRET_NAME}" \
		-n "${NAMESPACE}" \
		--from-literal=GYRE_ENCRYPTION_KEY="${GYRE_ENCRYPTION_KEY}" \
		--from-literal=AUTH_ENCRYPTION_KEY="${AUTH_ENCRYPTION_KEY}" \
		--from-literal=BACKUP_ENCRYPTION_KEY="${BACKUP_ENCRYPTION_KEY}" \
		--dry-run=client -o yaml | kubectl apply -f -
elif [ "${#encryption_missing_keys[@]}" -gt 0 ]; then
	echo "Adding missing encryption keys to '${ENCRYPTION_SECRET_NAME}': ${encryption_missing_keys[*]}"
	encryption_patch='{"stringData":{'
	for key in "${encryption_missing_keys[@]}"; do
		encryption_patch+="\"${key}\":\"${!key}\","
	done
	encryption_patch="${encryption_patch%,}}"
	kubectl patch secret "${ENCRYPTION_SECRET_NAME}" -n "${NAMESPACE}" --type merge -p "${encryption_patch}" >/dev/null
else
	echo "Encryption secret '${ENCRYPTION_SECRET_NAME}' already has all required keys."
fi

metrics_secret_exists=false
if kubectl get secret "${METRICS_SECRET_NAME}" -n "${NAMESPACE}" >/dev/null 2>&1; then
	metrics_secret_exists=true
fi

metrics_token_missing=false
if value="$(read_secret_value "${METRICS_SECRET_NAME}" "GYRE_METRICS_TOKEN")"; then
	GYRE_METRICS_TOKEN="${value}"
else
	GYRE_METRICS_TOKEN="${GYRE_METRICS_TOKEN:-$(openssl rand -hex 32)}"
	metrics_token_missing=true
fi

if ! ${metrics_secret_exists}; then
	echo "Creating metrics secret '${METRICS_SECRET_NAME}'..."
	kubectl create secret generic "${METRICS_SECRET_NAME}" \
		-n "${NAMESPACE}" \
		--from-literal=GYRE_METRICS_TOKEN="${GYRE_METRICS_TOKEN}" \
		--dry-run=client -o yaml | kubectl apply -f -
elif ${metrics_token_missing}; then
	echo "Adding missing GYRE_METRICS_TOKEN to '${METRICS_SECRET_NAME}'..."
	kubectl patch secret "${METRICS_SECRET_NAME}" -n "${NAMESPACE}" --type merge \
		-p "{\"stringData\":{\"GYRE_METRICS_TOKEN\":\"${GYRE_METRICS_TOKEN}\"}}" >/dev/null
else
	echo "Metrics secret '${METRICS_SECRET_NAME}' already has GYRE_METRICS_TOKEN."
fi

echo "Installing Gyre via Helm..."
helm_args=(
	upgrade --install "${HELM_RELEASE}" "oci://ghcr.io/entropy0120/charts/gyre"
	--namespace "${NAMESPACE}"
	--create-namespace
	--wait
	--timeout "${HELM_TIMEOUT}"
	--set "encryption.existingSecret=${ENCRYPTION_SECRET_NAME}"
	--set "metrics.existingSecret=${METRICS_SECRET_NAME}"
	--set "admin.secretName=${ADMIN_SECRET_NAME}"
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
		if [ -t 1 ]; then
			echo "Password (local demo only): ${PASSWORD}"
		else
			echo "Password: hidden (shown only for interactive local demo runs)."
		fi
	fi
fi
echo ""
echo "Access the UI:"
echo "  kubectl port-forward -n ${NAMESPACE} svc/${HELM_RELEASE} ${PORT}:80"
echo "  http://localhost:${PORT}"
