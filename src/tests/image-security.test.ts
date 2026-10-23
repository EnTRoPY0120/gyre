import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { parse } from 'yaml';
import { afterEach, beforeEach, describe, expect, test } from 'vitest';

const gateScript = resolve('scripts/image-security.mjs');
const bothPlatforms = 'linux/amd64,linux/arm64';
let directory: string;

function scanReport(arch: string, severities: string[] = []) {
	return {
		SchemaVersion: 2,
		ArtifactName: `gyre:scan-${arch}`,
		ArtifactType: 'container_image',
		Metadata: { ImageConfig: { architecture: arch } },
		Results: [
			{
				Target: 'app/node_modules/example/package.json',
				Class: 'lang-pkgs',
				Type: 'node-pkg',
				Vulnerabilities: severities.map((Severity, index) => ({
					VulnerabilityID: `CVE-2026-${index}`,
					PkgName: 'example',
					InstalledVersion: '1.0.0',
					Severity
				}))
			}
		]
	};
}

function writeReport(arch: string, severities: string[] = []) {
	writeFileSync(
		join(directory, `trivy-${arch}.json`),
		JSON.stringify(scanReport(arch, severities))
	);
}

function run(
	mode: 'prepare' | 'gate',
	options: { platforms?: string; env?: NodeJS.ProcessEnv } = {}
) {
	return spawnSync(
		process.execPath,
		[gateScript, mode, directory, options.platforms ?? bothPlatforms],
		{
			encoding: 'utf8',
			env: {
				...process.env,
				PATH: `${directory}:${process.env.PATH}`,
				AMD64_SCAN_OUTCOME: 'success',
				ARM64_SCAN_OUTCOME: 'success',
				...options.env
			}
		}
	);
}

beforeEach(() => {
	directory = mkdtempSync(join(tmpdir(), 'gyre-image-security-'));
	// Stand in for the external converter; exercise the real report preparation and gate CLIs.
	writeFileSync(
		join(directory, 'trivy'),
		`#!/usr/bin/env node
const { readFileSync, writeFileSync } = require('node:fs');
const args = process.argv.slice(2);
if (args[0] !== 'convert' || args[args.indexOf('--severity') + 1] !== 'UNKNOWN,LOW,MEDIUM,HIGH,CRITICAL') process.exit(2);
const report = JSON.parse(readFileSync(args.at(-1), 'utf8'));
if (process.env.FAIL_CONVERSION === report.Metadata.ImageConfig.architecture) process.exit(2);
writeFileSync(args[args.indexOf('--output') + 1], JSON.stringify({
  version: '2.1.0',
  runs: [{ tool: { driver: { name: 'Trivy' } }, results: report.Results.flatMap(r => r.Vulnerabilities ?? []).map(v => ({ ruleId: v.VulnerabilityID })) }]
}));
`,
		{ mode: 0o755 }
	);
	writeReport('amd64');
	writeReport('arm64');
});

afterEach(() => rmSync(directory, { recursive: true, force: true }));

describe('packaged-image vulnerability gate', () => {
	test.each([[], ['LOW'], ['MEDIUM'], ['UNKNOWN', 'LOW', 'MEDIUM']])(
		'accepts reports containing only %j',
		(...severities) => {
			writeReport('arm64', severities);
			expect(run('prepare').status).toBe(0);
			expect(run('gate').status).toBe(0);
		}
	);

	test.each(['HIGH', 'CRITICAL'])(
		'blocks %s on either architecture and retains reports',
		(severity) => {
			for (const arch of ['amd64', 'arm64']) {
				writeReport('amd64');
				writeReport('arm64');
				writeReport(arch, ['LOW', severity]);
				expect(run('prepare').status).toBe(0);
				const gate = run('gate');
				expect(gate.status).toBe(1);
				expect(gate.stdout).toContain('HIGH or CRITICAL vulnerabilities found');
				const summary = JSON.parse(readFileSync(join(directory, 'summary.json'), 'utf8'));
				expect(summary.passed).toBe(false);
				expect(summary.results).toHaveLength(2);
				for (const reportArch of ['amd64', 'arm64']) {
					const report = JSON.parse(
						readFileSync(join(directory, `trivy-${reportArch}.json`), 'utf8')
					);
					const sarif = JSON.parse(
						readFileSync(join(directory, `trivy-${reportArch}.sarif`), 'utf8')
					);
					expect(sarif.runs[0].results).toHaveLength(report.Results[0].Vulnerabilities.length);
				}
			}
		}
	);

	test.each(['failure', 'skipped', 'cancelled', ''])(
		'blocks scanner outcome %j even with a report',
		(outcome) => {
			expect(run('prepare', { env: { AMD64_SCAN_OUTCOME: outcome } }).status).toBe(0);
			const gate = run('gate');
			expect(gate.status).toBe(1);
			expect(gate.stdout).toContain('Scanner did not succeed');
			expect(
				JSON.parse(readFileSync(join(directory, 'trivy-arm64.sarif'), 'utf8')).runs
			).toHaveLength(1);
		}
	);

	test.each([
		'missing',
		'truncated',
		'wrong-schema',
		'wrong-architecture',
		'invalid-vulnerability'
	])('blocks a %s JSON report and still converts the other architecture', (failure) => {
		const path = join(directory, 'trivy-amd64.json');
		if (failure === 'missing') rmSync(path);
		if (failure === 'truncated') writeFileSync(path, '{');
		if (failure === 'wrong-schema') writeFileSync(path, '{}');
		if (failure === 'wrong-architecture') writeFileSync(path, JSON.stringify(scanReport('arm64')));
		if (failure === 'invalid-vulnerability') writeReport('amd64', ['INVALID']);
		expect(run('prepare').status).toBe(0);
		expect(run('gate').status).toBe(1);
		expect(
			JSON.parse(readFileSync(join(directory, 'trivy-arm64.sarif'), 'utf8')).runs
		).toHaveLength(1);
	});

	test('blocks conversion errors and continues preparing the other architecture', () => {
		expect(run('prepare', { env: { FAIL_CONVERSION: 'amd64' } }).status).toBe(0);
		expect(run('gate').status).toBe(1);
		expect(
			JSON.parse(readFileSync(join(directory, 'trivy-arm64.sarif'), 'utf8')).runs
		).toHaveLength(1);
	});

	test.each(['missing', 'invalid'])('blocks %s SARIF after preparation', (failure) => {
		expect(run('prepare').status).toBe(0);
		const path = join(directory, 'trivy-arm64.sarif');
		if (failure === 'missing') rmSync(path);
		else writeFileSync(path, '{}');
		expect(run('gate').status).toBe(1);
	});

	test('blocks absent scan status and a missing selected architecture', () => {
		expect(run('gate').status).toBe(1);
		expect(run('prepare', { platforms: 'linux/amd64' }).status).toBe(0);
		expect(run('gate').status).toBe(1);
		expect(run('gate', { platforms: 'linux/amd64' }).status).toBe(0);
	});
});

describe('image workflow security boundaries', () => {
	const workflow = parse(readFileSync(resolve('.github/workflows/build.yml'), 'utf8'));
	const build = workflow.jobs['build-image'];
	const steps = build.steps;

	test('collects selected scans and uploads diagnostic reports before the publishing gate', () => {
		const uploadIndex = steps.findIndex((step) => step.id === 'security-artifact');
		const gateIndex = steps.findIndex((step) => step.run?.includes('image-security.mjs gate'));
		expect(uploadIndex).toBeLessThan(gateIndex);
		for (const arch of ['amd64', 'arm64']) {
			const scan = steps.find((step) => step.id === `scan-${arch}`);
			expect(scan['continue-on-error']).toBe(true);
			expect(scan.if).toContain('!cancelled()');
			expect(scan.with.format).toBe('json');
			expect(scan.with.severity.split(',')).toContain('LOW');
			expect(scan.with['exit-code']).toBe('0');
		}
		expect(steps.findIndex((step) => step.id === 'image-artifact')).toBeGreaterThan(gateIndex);
		expect(workflow.jobs.smoke.needs).toBe('build-image');
		expect(workflow.jobs.publish.needs).toEqual(['build-image', 'smoke']);
	});

	test('uploads both SARIF categories independently of publishing or gate success, outside PR jobs', () => {
		const reporting = workflow.jobs['report-security'];
		expect(reporting.needs).toBe('build-image');
		expect(reporting.if).toContain('always()');
		expect(reporting.if).toContain("github.event_name != 'pull_request'");
		expect(reporting.if).not.toContain('verification_only');
		expect(reporting.if).not.toContain('.result');
		expect(reporting.permissions).toEqual({ 'security-events': 'write' });
		expect(build.permissions).toEqual({ contents: 'read' });
		expect(
			reporting.steps.filter((step) => step.with?.category).map((step) => step.with.category)
		).toEqual(['container-scan', 'container-scan/amd64']);
	});
});
