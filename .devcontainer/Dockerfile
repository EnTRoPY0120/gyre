FROM mcr.microsoft.com/devcontainers/javascript-node:1-22-bookworm

ARG TARGETARCH
ENV KIND_VERSION=v0.30.0
ENV FLUX_VERSION=2.8.8

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
		amd64) expected_kind_sha256="517ab7fc89ddeed5fa65abf71530d90648d9638ef0c4cde22c2c11f8097b8889" ;; \
		arm64) expected_kind_sha256="7ea2de9d2d190022ed4a8a4e3ac0636c8a455e460b9a13ccf19f15d07f4f00eb" ;; \
		*) echo "Unsupported kind architecture: ${kind_arch}" >&2; exit 1 ;; \
	esac; \
	kind_tmp="$(mktemp)"; \
	curl -fsSL "https://kind.sigs.k8s.io/dl/${KIND_VERSION}/kind-linux-${kind_arch}" -o "${kind_tmp}"; \
	echo "${expected_kind_sha256}  ${kind_tmp}" | sha256sum -c -; \
	install -m 0755 "${kind_tmp}" /usr/local/bin/kind; \
	rm -f "${kind_tmp}"

RUN set -eux; \
	flux_arch="${TARGETARCH:-$(dpkg --print-architecture)}"; \
	case "${flux_arch}" in \
		amd64) expected_flux_sha256="3791d8fbb73b967ada021186f7b46686a2b180ce206d3c279c3f2ad183877a7f" ;; \
		arm64) expected_flux_sha256="738604ab040055ace69777988a24def98ada1aff14ae4726e733089dc8cc5e12" ;; \
		*) echo "Unsupported flux architecture: ${flux_arch}" >&2; exit 1 ;; \
	esac; \
	flux_archive="flux_${FLUX_VERSION}_linux_${flux_arch}.tar.gz"; \
	flux_tmp_dir="$(mktemp -d)"; \
	curl -fsSL "https://github.com/fluxcd/flux2/releases/download/v${FLUX_VERSION}/${flux_archive}" -o "${flux_tmp_dir}/${flux_archive}"; \
	echo "${expected_flux_sha256}  ${flux_tmp_dir}/${flux_archive}" | sha256sum -c -; \
	tar -xzf "${flux_tmp_dir}/${flux_archive}" -C "${flux_tmp_dir}" flux; \
	install -m 0755 "${flux_tmp_dir}/flux" /usr/local/bin/flux; \
	rm -rf "${flux_tmp_dir}"

RUN npm install --global pnpm@11.1.0

USER node
