# GitHub Packages (GHCR) Setup for Public Repository

## Overview

This guide explains how the GitHub Actions workflow publishes Docker images to GitHub Container Registry (ghcr.io) for a **public repository**.

## How It Works

### Authentication

For **public repositories**, GitHub Actions automatically has permission to push to GHCR using `GITHUB_TOKEN`:

```yaml
- name: Log in to GitHub Container Registry
  uses: docker/login-action@v3
  with:
    registry: ghcr.io
    username: ${{ github.actor }}  # Your GitHub username
    password: ${{ secrets.GITHUB_TOKEN }}  # Auto-provided token
```

**No additional setup required!** The `GITHUB_TOKEN` is automatically available in all workflows.

### Image Naming

```yaml
env:
  REGISTRY: ghcr.io
  IMAGE_NAME: entropy0120/gyre  # Must be lowercase!
```

**Important:** GitHub Container Registry requires lowercase names. Your repository is `EnTRoPY0120/gyre`, but the image must be `entropy0120/gyre`.

## Published Image Tags

The workflow automatically creates these tags:

### Branch-based Tags

| Trigger | Tag Example |
|---------|-------------|
| Push to `main` | `ghcr.io/entropy0120/gyre:main` |
| Push to `main` | `ghcr.io/entropy0120/gyre:latest` |
| Push to `develop` | `ghcr.io/entropy0120/gyre:develop` |

### Version Tags (Git Tags)

| Git Tag | Generated Tags |
|---------|----------------|
| `v1.2.3` | `ghcr.io/entropy0120/gyre:1.2.3` |
| `v1.2.3` | `ghcr.io/entropy0120/gyre:1.2` |
| `v1.2.3` | `ghcr.io/entropy0120/gyre:1` |

### Commit SHA Tags

| Trigger | Tag Example |
|---------|-------------|
| Any push | `ghcr.io/entropy0120/gyre:main-abc1234` |

### Pull Request Tags

| Trigger | Tag Example |
|---------|-------------|
| PR #42 | `ghcr.io/entropy0120/gyre:pr-42` (not pushed) |

## First-Time Setup

### 1. Enable GitHub Actions (Already Done)

Your workflow file is at `.github/workflows/build.yml` ✅

### 2. Make Package Public

After the first successful workflow run:

1. Go to https://github.com/EnTRoPY0120?tab=packages
2. Find the `gyre` package
3. Click **Package settings** (bottom right)
4. Scroll to **Danger Zone**
5. Click **Change visibility** → **Public**

This makes your container image publicly pullable without authentication.

### 3. Link Package to Repository (Optional)

1. In Package settings, find **Connect repository**
2. Select `EnTRoPY0120/gyre`
3. This shows the package on your repository's main page

## Triggering Builds

### Automatic Triggers

```bash
# Push to main branch
git push origin main
# → Builds and pushes: ghcr.io/entropy0120/gyre:main, :latest

# Create and push a version tag
git tag v0.1.0
git push origin v0.1.0
# → Builds and pushes: ghcr.io/entropy0120/gyre:0.1.0, :0.1, :0

# Push to develop branch
git push origin develop
# → Builds and pushes: ghcr.io/entropy0120/gyre:develop
```

### Manual Trigger

1. Go to https://github.com/EnTRoPY0120/gyre/actions
2. Click **Build and Publish Docker Image**
3. Click **Run workflow**
4. Select branch
5. Click **Run workflow**

## Using the Published Images

### Pull the Image

```bash
# Latest version
docker pull ghcr.io/entropy0120/gyre:latest

# Specific version
docker pull ghcr.io/entropy0120/gyre:0.1.0

# Specific commit
docker pull ghcr.io/entropy0120/gyre:main-abc1234
```

### Use in Helm Chart

The Helm chart is already configured:

```yaml
# charts/gyre/values.yaml
image:
  repository: ghcr.io/entropy0120/gyre
  tag: ""  # Defaults to Chart.yaml appVersion
  pullPolicy: IfNotPresent
```

Install with default (latest) image:
```bash
helm install gyre charts/gyre --namespace flux-system
```

Install with specific version:
```bash
helm install gyre charts/gyre \
  --namespace flux-system \
  --set image.tag=0.1.0
```

### Use in Docker

```bash
docker run -p 3000:3000 \
  -v $(pwd)/data:/data \
  ghcr.io/entropy0120/gyre:latest
```

### Use in Kubernetes (raw YAML)

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: gyre
spec:
  template:
    spec:
      containers:
      - name: gyre
        image: ghcr.io/entropy0120/gyre:latest
        # No imagePullSecrets needed for public images!
```

## Workflow Features

### ✅ Multi-Architecture Support

Builds for both platforms:
- `linux/amd64` (Intel/AMD CPUs)
- `linux/arm64` (Apple Silicon, Raspberry Pi, AWS Graviton)

### ✅ Build Cache

Uses GitHub Actions cache for faster rebuilds:
```yaml
cache-from: type=gha
cache-to: type=gha,mode=max
```

Second builds are ~70% faster!

### ✅ Supply Chain Security

Automatically generates:
- **SBOM** (Software Bill of Materials)
- **Provenance** (Build attestation)

View with:
```bash
docker buildx imagetools inspect ghcr.io/entropy0120/gyre:latest --format "{{json .Provenance}}"
```

### ✅ Build Summary

After each successful build, see a summary at:
- Actions → Workflow run → Summary tab

Includes:
- Published tags
- Pull commands
- Helm installation commands

### ✅ PR Comments

Pull requests get automatic comments with build status.

## Monitoring Builds

### Check Workflow Status

1. Go to https://github.com/EnTRoPY0120/gyre/actions
2. Click on latest workflow run
3. Check build logs

### GitHub Badge

Add to your README.md:

```markdown
![Docker Build](https://github.com/EnTRoPY0120/gyre/actions/workflows/build.yml/badge.svg)
```

Result: ![Docker Build](https://github.com/EnTRoPY0120/gyre/actions/workflows/build.yml/badge.svg)

## Troubleshooting

### Build Fails with "permission denied"

**Solution:** Check that workflow has `packages: write` permission:
```yaml
permissions:
  packages: write
```

This is already configured ✅

### Image push fails with "unauthorized"

**Cause:** `GITHUB_TOKEN` doesn't have package write permission.

**Solution:** The workflow already uses the correct token. If this happens, it's likely a GitHub issue. Try:
1. Re-run the workflow
2. Check repository settings → Actions → General → Workflow permissions

### Can't pull image without login

**Cause:** Package is still private.

**Solution:** Make package public (see step 2 above).

### Wrong image name (404)

**Cause:** Using mixed case in image name.

**Solution:** Always use lowercase: `ghcr.io/entropy0120/gyre` (not `EnTRoPY0120`)

### Build is slow

**Cause:** Cache not working or first build.

**Solution:**
- First build is slow (10-15 min)
- Second builds are fast (3-5 min)
- Cache expires after 7 days of no builds

## Best Practices

### 1. Version Tagging

Use semantic versioning for releases:
```bash
git tag -a v0.1.0 -m "Initial release"
git push origin v0.1.0
```

This creates multiple tags:
- `0.1.0` (exact version)
- `0.1` (minor version)
- `0` (major version)

### 2. Helm Chart Versioning

Keep Chart.yaml version in sync:
```yaml
# charts/gyre/Chart.yaml
version: 0.1.0
appVersion: "0.1.0"
```

### 3. Test Before Tagging

Always test on `main` or `develop` before creating version tags:
```bash
# Push to main first
git push origin main

# Wait for build to succeed
# Test the image

# Then tag
git tag v0.1.0
git push origin v0.1.0
```

### 4. Branch Protection

Enable branch protection for `main`:
1. Settings → Branches → Add rule
2. Branch name: `main`
3. ✅ Require status checks to pass
4. Search for: `build-and-push`
5. Save

This prevents merging if Docker build fails.

### 5. Dependabot Updates

Enable Dependabot to keep workflow actions updated:

```yaml
# .github/dependabot.yml
version: 2
updates:
  - package-ecosystem: "github-actions"
    directory: "/"
    schedule:
      interval: "weekly"
```

## Package Visibility

### Current Setup (After First Build)

1. Package created automatically on first push
2. Initially **private** by default
3. Manually make **public** (one-time)

### Making Package Public

```bash
# After first successful workflow run:
# 1. Visit: https://github.com/EnTRoPY0120?tab=packages
# 2. Click on "gyre" package
# 3. Package settings → Change visibility → Public
```

Once public:
- Anyone can pull without authentication ✅
- Appears in your profile packages
- Searchable on GitHub

### Keeping Package Private

If you want to keep it private:
- Users need to authenticate to pull:
```bash
echo $GITHUB_TOKEN | docker login ghcr.io -u username --password-stdin
docker pull ghcr.io/entropy0120/gyre:latest
```

For public FluxCD dashboard, **public is recommended**.

## Next Steps

1. **Push to main branch** to trigger first build:
   ```bash
   git add .
   git commit -m "feat: add Docker build workflow"
   git push origin main
   ```

2. **Watch the build**:
   - Go to Actions tab
   - Click on running workflow
   - Monitor progress

3. **Make package public**:
   - After build succeeds
   - Follow steps in "First-Time Setup" above

4. **Test the image**:
   ```bash
   docker pull ghcr.io/entropy0120/gyre:latest
   docker run -p 3000:3000 -v $(pwd)/data:/data ghcr.io/entropy0120/gyre:latest
   ```

5. **Update Helm chart** (if needed):
   ```bash
   # Update values.yaml with correct repository
   helm install gyre charts/gyre --namespace flux-system
   ```

## Summary

✅ **What's configured:**
- Multi-arch builds (amd64, arm64)
- Automatic tagging (branch, version, SHA)
- GHCR authentication (via GITHUB_TOKEN)
- Build cache for fast rebuilds
- Supply chain security (SBOM, provenance)
- Build summaries and PR comments

✅ **What you need to do:**
1. Push to `main` branch (triggers first build)
2. Make package public (one-time, after first build)
3. Use the images!

🎯 **Your image will be available at:**
```
ghcr.io/entropy0120/gyre:latest
```

---

**Questions?** Check the workflow logs in the Actions tab or review this guide.
