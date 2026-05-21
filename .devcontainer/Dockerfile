FROM mcr.microsoft.com/devcontainers/javascript-node:1-22-bookworm

ARG TARGETARCH

USER root

RUN set -eux; \
	apt-get update; \
	apt-get install -y --no-install-recommends \
		apt-transport-https \
		ca-certificates \
		curl \
		gnupg; \
	mkdir -p /etc/apt/keyrings; \
	curl -fsSL https://pkgs.k8s.io/core:/stable:/v1.34/deb/Release.key | gpg --dearmor -o /etc/apt/keyrings/kubernetes-apt-keyring.gpg; \
	echo "deb [signed-by=/etc/apt/keyrings/kubernetes-apt-keyring.gpg] https://pkgs.k8s.io/core:/stable:/v1.34/deb/ /" > /etc/apt/sources.list.d/kubernetes.list; \
	curl -fsSL https://baltocdn.com/helm/signing.asc | gpg --dearmor -o /etc/apt/keyrings/helm.gpg; \
	echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/helm.gpg] https://baltocdn.com/helm/stable/debian/ all main" > /etc/apt/sources.list.d/helm-stable-debian.list; \
	apt-get update; \
	apt-get install -y --no-install-recommends \
		helm \
		kubectl; \
	rm -rf /var/lib/apt/lists/*

RUN set -eux; \
	kind_arch="${TARGETARCH:-$(dpkg --print-architecture)}"; \
	case "${kind_arch}" in \
		amd64|arm64) ;; \
		*) echo "Unsupported kind architecture: ${TARGETARCH}" >&2; exit 1 ;; \
	esac; \
	curl -fsSL "https://kind.sigs.k8s.io/dl/v0.30.0/kind-linux-${kind_arch}" -o /usr/local/bin/kind; \
	chmod 0755 /usr/local/bin/kind

RUN set -eux; \
	curl -fsSL https://fluxcd.io/install.sh | bash

RUN npm install --global pnpm@11.1.0

USER node
