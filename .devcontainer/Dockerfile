FROM mcr.microsoft.com/devcontainers/base:bullseye

# Create vscode user if it doesn't exist
RUN if ! id -u vscode > /dev/null 2>&1; then \
      useradd -m -s /bin/bash vscode; \
    fi

# Install Bun globally to /usr/local (accessible to all users)
RUN curl -fsSL https://bun.sh/install | bash && \
    mkdir -p /usr/local/bun && \
    cp -r /root/.bun/* /usr/local/bun/ && \
    rm -rf /root/.bun
ENV BUN_INSTALL="/usr/local/bun"
ENV PATH="$BUN_INSTALL/bin:$PATH"

# Install kubectl
RUN curl -LO "https://dl.k8s.io/release/$(curl -L -s https://dl.k8s.io/release/stable.txt)/bin/linux/amd64/kubectl" && \
    chmod +x kubectl && \
    mv kubectl /usr/local/bin/

# Install helm
RUN curl https://raw.githubusercontent.com/helm/helm/main/scripts/get-helm-3 | bash

# Install kind (Kubernetes in Docker)
GOARCH="amd64"
GOOS="linux"
KIND_VERSION="v0.25.0"
curl -Lo ./kind "https://kind.sigs.k8s.io/dl/${KIND_VERSION}/kind-${GOOS}-${GOARCH}"
chmod +x ./kind
mv ./kind /usr/local/bin/kind

# Install git
RUN apt-get update && \
    apt-get install -y git && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

# Configure PATH for vscode user
RUN echo 'export PATH="/usr/local/bun/bin:$PATH"' >> /home/vscode/.bashrc && \
    echo 'export BUN_INSTALL="/usr/local/bun"' >> /home/vscode/.bashrc && \
    chown vscode:vscode /home/vscode/.bashrc

# Verify installations
RUN kubectl version --client && \
    helm version && \
    bun --version && \
    kind version
