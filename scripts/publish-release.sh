#!/usr/bin/env bash
# Called only after the image workflow has published and verified the tested OCI index.
set -euo pipefail

tag=${1:?version tag required}
digest=${2:?tested image digest required}
platforms=${3:?tested platforms required}
[[ "$tag" =~ ^v[0-9]+\.[0-9]+\.[0-9]+(-[0-9A-Za-z.-]+)?(\+[0-9A-Za-z.-]+)?$ ]]
[[ "$digest" =~ ^sha256:[a-f0-9]{64}$ ]]
[[ "$platforms" == 'linux/amd64,linux/arm64' ]]
version=${tag#v}
image_version=${version%%+*}
release_dir=$(mktemp -d)
trap 'rm -rf "$release_dir"' EXIT

helm package charts/gyre --version "$version" --app-version "$version" --destination "$release_dir"
helm push "$release_dir/gyre-${version}.tgz" oci://ghcr.io/entropy0120/charts

cat > "$release_dir/notes.md" <<EOF_NOTES
## Release $tag

### Docker image

Version: \`ghcr.io/entropy0120/gyre:$image_version\`

Tested and published OCI index: \`$digest\`

Supported architectures: **linux/amd64** and **linux/arm64**.

\`\`\`bash
docker pull ghcr.io/entropy0120/gyre:$image_version
docker pull ghcr.io/entropy0120/gyre@$digest
\`\`\`

### Kubernetes installation

\`\`\`bash
helm install gyre oci://ghcr.io/entropy0120/charts/gyre \\
  --version $version \\
  --namespace flux-system \\
  --create-namespace
\`\`\`

Includes the Helm chart, RBAC configuration, and generated admin credentials.
See the [Installation Guide](https://entropy0120.github.io/gyre/installation) for setup and credentials.
EOF_NOTES

release_args=(--verify-tag --title "Release $tag" --notes-file "$release_dir/notes.md" --generate-notes)
if [[ "$image_version" == *-* ]]; then release_args+=(--prerelease); fi
gh release create "$tag" "${release_args[@]}"
if [[ -n "${GITHUB_STEP_SUMMARY:-}" ]]; then
  printf '### Release %s\n\n- Image digest: `%s`\n- Platforms: %s\n' "$tag" "$digest" "$platforms" >> "$GITHUB_STEP_SUMMARY"
fi
