# Packaged image smoke test

`pnpm smoke:image --image <local-image> --platform linux/amd64|linux/arm64` validates an already-built Docker image. It does not build, tag, or publish the image. The local image architecture must match `--platform`.

The command checks the production container health endpoint, UID 1001, Node architecture, real native SQLite reads and writes, and the application database's read-only integrity result. Chromium then signs in, changes the initial admin password, confirms the old password fails and the new password works in a fresh session, saves audit retention as 91 days, reloads it, and checks production JavaScript and CSS responses, MIME types, page errors, and same-origin failed requests.

It next creates a uniquely named disposable Kind cluster, installs the Flux CRDs, and runs the same image inside the cluster. Controlled source artifacts and Kubernetes status updates exercise Flux actions, SSE-backed public history, rollback previews, server-side apply previews, schema errors, RBAC denial, and browser rendering/export of preview failures. Preview assertions check that the live spec and resourceVersion remain unchanged.

Requirements are Docker, Node and pnpm dependencies installed from the frozen lockfile, Chromium and its system dependencies (`pnpm exec playwright install --with-deps chromium`), Kind, kubectl, and Flux CLI. The caller needs permission to run Docker and create/delete Kind clusters. Random credentials and cluster config are kept in a private temporary directory; owned containers, child processes, and clusters are cleaned up on success, failure, SIGINT, and SIGTERM.

The image workflow runs this against the scanned amd64 image on pull requests. On branch and release builds it also smoke-tests the scanned arm64 image before either image is published.
