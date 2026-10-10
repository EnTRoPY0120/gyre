import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { load } from 'js-yaml';
import { afterEach, expect, test } from 'vitest';

interface Job {
	if?: string;
	needs?: string[];
	uses?: string;
	with?: Record<string, string>;
	steps: { name: string; run?: string }[];
}
interface Workflow {
	on: Record<string, unknown>;
	jobs: Record<string, Job>;
}
const workflow = (name: string) =>
	load(readFileSync(`.github/workflows/${name}.yml`, 'utf8')) as Workflow;
const digest = `sha256:${'a'.repeat(64)}`;
const dirs: string[] = [];
afterEach(() => {
	for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

function publisherEnvironment(failure = '') {
	const dir = mkdtempSync(join(tmpdir(), 'gyre-release-'));
	dirs.push(dir);
	writeFileSync(
		join(dir, 'helm'),
		`#!/usr/bin/env bash
set -eu
printf '%s\\n' "helm $*" >> "$PUBLISH_LOG"
if [[ "\${FAIL_COMMAND:-}" == "helm-$1" ]]; then exit 42; fi
`,
		{ mode: 0o755 }
	);
	writeFileSync(
		join(dir, 'gh'),
		`#!/usr/bin/env bash
set -eu
printf '%s\\n' "gh $*" >> "$PUBLISH_LOG"
while (( $# )); do
  if [[ "$1" == --notes-file ]]; then cp "$2" "$CAPTURED_NOTES"; break; fi
  shift
done
`,
		{ mode: 0o755 }
	);
	return {
		dir,
		env: {
			...process.env,
			PATH: `${dir}:${process.env.PATH}`,
			FAIL_COMMAND: failure,
			PUBLISH_LOG: join(dir, 'commands'),
			CAPTURED_NOTES: join(dir, 'notes'),
			GITHUB_STEP_SUMMARY: join(dir, 'summary')
		}
	};
}

test('release is reusable and requires successful build, smoke and publication for version tag pushes', () => {
	const build = workflow('build');
	const release = workflow('release');
	expect(Object.keys(release.on)).toEqual(['workflow_call']);
	expect(build.jobs.release.needs).toEqual(['build-image', 'smoke', 'publish']);
	expect(build.jobs.release.uses).toBe('./.github/workflows/release.yml');
	expect(build.jobs.release.if).toBe(
		"github.event_name == 'push' && startsWith(github.ref, 'refs/tags/v') && inputs.verification_only != true"
	);
	expect(build.jobs.release.if).not.toContain('always()');
	expect(build.jobs.release.with).toEqual({
		tag: '${{ github.ref_name }}',
		image_digest: '${{ needs.build-image.outputs.digest }}',
		platforms: '${{ needs.build-image.outputs.platforms }}'
	});
	expect(build.jobs.publish.needs).toEqual(['build-image', 'smoke']);
	expect(build.jobs.publish.if).toBe(
		"github.event_name != 'pull_request' && inputs.verification_only != true"
	);
	expect(release.jobs.release.if).toBe(
		"github.event_name == 'push' && startsWith(github.ref, 'refs/tags/v') && inputs.tag == github.ref_name"
	);
});

test.each([
	['v1.2.3', '1.2.3', false],
	['v1.2.3-rc.1', '1.2.3-rc.1', true],
	['v1.2.3+build.1', '1.2.3', false],
	['v1.2.3+build-1', '1.2.3', false],
	['v1.2.3-rc.1+build-1', '1.2.3-rc.1', true]
])('publishes %s with image tag %s and prerelease=%s', (tag, imageVersion, prerelease) => {
	const { env } = publisherEnvironment();
	execFileSync('bash', ['scripts/publish-release.sh', tag, digest, 'linux/amd64,linux/arm64'], {
		env
	});
	const commands = readFileSync(env.PUBLISH_LOG, 'utf8').trim().split('\n');
	expect(commands[0]).toContain(
		`helm package charts/gyre --version ${tag.slice(1)} --app-version ${tag.slice(1)}`
	);
	expect(commands[1]).toContain('helm push');
	expect(commands[2]).toContain(`gh release create ${tag} --verify-tag`);
	expect(commands[2].includes('--prerelease')).toBe(prerelease);
	const notes = readFileSync(env.CAPTURED_NOTES, 'utf8');
	for (const value of [tag, digest, 'linux/amd64', 'linux/arm64']) expect(notes).toContain(value);
	const imageTag = `ghcr.io/entropy0120/gyre:${imageVersion}`;
	const noteLines = notes.split(/\r?\n/);
	expect(noteLines).toContain('Version: `' + imageTag + '`');
	expect(noteLines).toContain('docker pull ' + imageTag);
	expect(notes).not.toMatch(/gyre:(latest|main)/);
});

test.each(['helm-package', 'helm-push'])(
	'failed %s prevents creating a GitHub release',
	(failure) => {
		const { env } = publisherEnvironment(failure);
		const result = spawnSync(
			'bash',
			['scripts/publish-release.sh', 'v1.2.3', digest, 'linux/amd64,linux/arm64'],
			{ env }
		);
		expect(result.status).toBe(42);
		expect(readFileSync(env.PUBLISH_LOG, 'utf8')).not.toContain('gh release');
	}
);

test.each([
	['main', digest, 'linux/amd64,linux/arm64'],
	['v1.2.3', 'invalid', 'linux/amd64,linux/arm64'],
	['v1.2.3', digest, 'linux/amd64']
])('rejects unsupported release metadata before publishing: %s', (...args) => {
	const { env } = publisherEnvironment();
	expect(spawnSync('bash', ['scripts/publish-release.sh', ...args], { env }).status).not.toBe(0);
	expect(() => readFileSync(env.PUBLISH_LOG)).toThrow();
});

test.each([false, true])(
	'image publication failure=%s propagates out of the blocking publish step',
	(fail) => {
		const { dir, env } = publisherEnvironment();
		// Execute the workflow's actual publish shell with deterministic registry commands.
		writeFileSync(
			join(dir, 'skopeo'),
			`#!/usr/bin/env bash
if [[ "$1" == copy ]]; then exit ${fail ? 42 : 0}; fi
printf 'verified-index'
`,
			{ mode: 0o755 }
		);
		const sha = execFileSync('sha256sum', { input: 'verified-index', encoding: 'utf8' }).split(
			' '
		)[0];
		const step = workflow('build').jobs.publish.steps.find(
			({ name }) => name === 'Publish exact tested OCI image and verify digest'
		)!;
		const script = step.run!.replaceAll('${{ runner.temp }}', dir);
		const result = spawnSync('bash', ['-c', script], {
			env: {
				...env,
				IMAGE_TAGS: 'ghcr.io/entropy0120/gyre:1.2.3',
				IMAGE_PREFIX: 'ghcr.io/entropy0120/gyre:',
				EXPECTED_DIGEST: `sha256:${sha}`,
				EXPECTED_SHA256: 'b'.repeat(64)
			}
		});
		expect(result.status).toBe(fail ? 42 : 0);
	}
);
