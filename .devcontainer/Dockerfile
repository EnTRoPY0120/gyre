FROM mcr.microsoft.com/devcontainers/javascript-node:26-trixie

ARG TARGETARCH
ARG KIND_VERSION=v0.33.0
ARG FLUX_VERSION=2.9.5

USER root

RUN set -eux; \
	apt-get update; \
	apt-get install -y --no-install-recommends \
		ca-certificates \
		curl \
		gnupg; \
	mkdir -p /etc/apt/keyrings; \
	curl -fsSL https://pkgs.k8s.io/core:/stable:/v1.37/deb/Release.key | gpg --dearmor -o /etc/apt/keyrings/kubernetes-apt-keyring.gpg; \
	echo "deb [signed-by=/etc/apt/keyrings/kubernetes-apt-keyring.gpg] https://pkgs.k8s.io/core:/stable:/v1.37/deb/ /" > /etc/apt/sources.list.d/kubernetes.list; \
	curl -fsSL https://packages.buildkite.com/helm-linux/helm-debian/gpgkey -o /tmp/helm.gpg; \
	if [ "$(gpg --show-keys --with-colons /tmp/helm.gpg | awk -F: '$1 == "fpr" { print $10; exit }')" != "DDF78C3E6EBB2D2CC223C95C62BA89D07698DBC6" ]; then echo "Unexpected Helm APT key fingerprint" >&2; exit 1; fi; \
	gpg --dearmor -o /etc/apt/keyrings/helm.gpg /tmp/helm.gpg; \
	rm /tmp/helm.gpg; \
	echo "deb [signed-by=/etc/apt/keyrings/helm.gpg] https://packages.buildkite.com/helm-linux/helm-debian/any/ any main" > /etc/apt/sources.list.d/helm-stable-debian.list; \
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
	curl -fsSL "https://kind.sigs.k8s.io/dl/${KIND_VERSION}/kind-linux-${kind_arch}" -o /usr/local/bin/kind; \
	chmod 0755 /usr/local/bin/kind

RUN set -eux; \
	curl -fsSL "https://raw.githubusercontent.com/fluxcd/flux2/v${FLUX_VERSION}/install/flux.sh" -o /tmp/flux-install.sh; \
	FLUX_VERSION="${FLUX_VERSION}" bash /tmp/flux-install.sh; \
	rm /tmp/flux-install.sh

RUN npm install --global pnpm@11.1.0

USER node
