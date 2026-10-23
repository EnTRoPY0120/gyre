# Security remediation validation

Validated against main at `f233f6898d1be36378f227752dd5d6806f9b267b` on 2026-10-23 (UTC).

## Dependency resolutions

| Package                       | Validated version                     |
| ----------------------------- | ------------------------------------- |
| devalue                       | 5.9.3                                 |
| dompurify                     | 3.4.17                                |
| ip-address                    | 10.7.4                                |
| undici                        | 8.10.2                                |
| source-map-js                 | 1.2.2                                 |
| postcss-selector-parser       | 7.1.6                                 |
| vite                          | 8.3.4, with a direct minimum of 8.3.3 |
| @vitest/mocker                | 5.0.3                                 |
| Kustomize / golang.org/x/text | v5.8.1 / v0.41.0                      |

Each targeted JavaScript package has one resolution in the regenerated shared lockfile.
The 4,320-minute strict minimum-release-age policy remains enabled.

The fresh database found an additional MEDIUM vulnerability, CVE-2026-111997,
in the plan's ip-address 10.7.1 target. The pin was raised to 10.7.4, which was
published on 2026-10-11 and already qualified under the release-age policy.
See the [upstream advisory](https://github.com/beaugunderson/ip-address/security/advisories/GHSA-rxp7-6hxx-x8q5)
and [npm release metadata](https://registry.npmjs.org/ip-address). Both images
were rebuilt and rescanned after this correction.

## Repository and gate checks

- `pnpm install --frozen-lockfile`: passed with the final dependency set.
- `pnpm verify:repo:ci`: passed, including formatting, lint, types, app build,
  1,289 tests in the main run, the separate 28-test timeout run, docs types/build,
  Helm lint, and shell syntax checks.
- `actionlint .github/workflows/build.yml`: passed.
- The 21 security gate tests cover clean/LOW/MEDIUM reports, HIGH/CRITICAL findings
  on either architecture, scanner failures, missing/malformed reports, architecture
  mismatches, failed SARIF conversion, retained reports, and workflow privilege boundaries.
- Real Trivy conversion retained LOW/MEDIUM fixture findings in SARIF and blocked
  a HIGH fixture only after preparing both architectures' reports.
- Typography generated prose, heading, large, and inverted rules with parser 7.1.6.
  Chromium verified heading size/weight, link underlines, and list markers.

## Final image scans and identity

Trivy v0.76.1 used the database updated at `2026-10-23T13:13:41Z`.
Both images were scanned with OS/library vulnerabilities, secrets, and
misconfigurations enabled, all severities included, and unfixed vulnerabilities
included. The existing ignore file was retained without changes.

| Architecture | UNKNOWN | LOW | MEDIUM | HIGH | CRITICAL |
| ------------ | ------- | --- | ------ | ---- | -------- |
| linux/amd64  | 0       | 0   | 0      | 0    | 0        |
| linux/arm64  | 0       | 0   | 0      | 0    | 0        |

Both JSON inventories contain the versions above, including Kustomize's x/text
v0.41.0. None of the 36 historical alert IDs appear in either image. The production
gate passed using these JSON reports and their derived SARIF.

- OCI index: `sha256:6f705b7185e244b2ab284995c9afffd05644bfd058e6c00a2c0430c9c7caa83b`
- Archive SHA-256: `c83f89e02393bc44fbc685f9d7c573962c2941bd09b9c8166313b0ad72d3b821`
- AMD64 manifest: `sha256:90baa831ebbe835f123a17766e00d84b115e841c684c893b971f94310667a0f3`
- ARM64 manifest: `sha256:606ce216fe5bd9fca91982e986d5395ede043f7eb3dd13b591df61f0fc38bbec`

The index digest matches the build metadata. Both imported Docker image config
digests match their original OCI manifests. Copying the complete index and its
attestations to two tags in a disposable local registry preserved the root digest.

## Packaged-image smoke tests

- `pnpm smoke:image --image gyre:scan-amd64 --platform linux/amd64`: passed.
- `pnpm smoke:image --image gyre:scan-arm64 --platform linux/arm64`: passed.

Both suites used images imported from the same scanned OCI archive. They passed
startup, UID 1001, native SQLite, browser login/password rotation, settings
persistence, production assets, Monaco editing and mode-switch persistence,
Kubernetes/Flux actions, SSE history, rollback, Kustomize/SSA previews, unchanged
live resources during preview, failed-preview viewer/export, and read-only RBAC.

Validation ran on an AMD64 host with QEMU for ARM64, using the workflow's pinned
Kind v0.33.0, Kubernetes v1.36.1, and Flux CLI v2.9.5. Disposable smoke clusters,
runtime containers, and the transport-test registry were removed successfully.

Local logs, JSON/SARIF reports, inventories, checksums, and transport evidence are
retained in the ignored `data/security-remediation/` directory.

## Required after merge

Require a successful default-branch build and Security reporting job, then verify
that all 36 historical alerts close automatically. ARM64 retains `container-scan`;
AMD64 uses `container-scan/amd64`. Do not dismiss the alerts manually. This
default-branch acceptance remains pending normal review and merge.
