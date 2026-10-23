#!/usr/bin/env node
/* oxlint-disable no-console -- CI gate diagnostics belong on stdout/stderr. */
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const severities = ['UNKNOWN', 'LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];

function readJson(path) {
	return JSON.parse(readFileSync(path, 'utf8'));
}

function requireValue(condition, message) {
	if (!condition) throw new Error(message);
}

function readScan(path, arch) {
	const report = readJson(path);
	requireValue(
		report?.SchemaVersion === 2 &&
			report.ArtifactType === 'container_image' &&
			typeof report.ArtifactName === 'string' &&
			report.ArtifactName.length > 0 &&
			Array.isArray(report.Results),
		'Invalid Trivy JSON report'
	);
	requireValue(
		report.Metadata?.ImageConfig?.architecture === arch,
		`Missing or incorrect image architecture (expected ${arch})`
	);
	const counts = Object.fromEntries(severities.map((severity) => [severity, 0]));
	for (const result of report.Results) {
		requireValue(
			result && typeof result.Target === 'string' && typeof result.Class === 'string',
			'Invalid Trivy result'
		);
		if (result.Vulnerabilities === undefined) continue;
		requireValue(Array.isArray(result.Vulnerabilities), 'Invalid vulnerability list');
		for (const vulnerability of result.Vulnerabilities) {
			requireValue(
				vulnerability &&
					typeof vulnerability.VulnerabilityID === 'string' &&
					typeof vulnerability.PkgName === 'string' &&
					typeof vulnerability.InstalledVersion === 'string' &&
					severities.includes(vulnerability.Severity),
				'Invalid vulnerability entry'
			);
			counts[vulnerability.Severity] += 1;
		}
	}
	return counts;
}

function validateSarif(path) {
	const sarif = readJson(path);
	requireValue(
		sarif?.version === '2.1.0' &&
			Array.isArray(sarif.runs) &&
			sarif.runs.length > 0 &&
			sarif.runs.every((run) => run?.tool?.driver?.name === 'Trivy' && Array.isArray(run.results)),
		'Invalid Trivy SARIF report'
	);
}

function evaluateReports(directory, platforms) {
	let status;
	try {
		status = readJson(join(directory, 'scan-status.json'));
		requireValue(
			JSON.stringify(status?.platforms) === JSON.stringify(platforms),
			'Missing or incorrect scan platforms'
		);
	} catch (error) {
		return { passed: false, errors: [error.message], results: [] };
	}
	const results = platforms.map((platform) => {
		const arch = platform.split('/')[1];
		const errors = [];
		let vulnerabilities;
		if (status.scans?.[arch]?.scan !== 'success') errors.push('Scanner did not succeed');
		if (status.scans?.[arch]?.conversion !== 'success')
			errors.push('SARIF conversion did not succeed');
		try {
			vulnerabilities = readScan(join(directory, `trivy-${arch}.json`), arch);
			if (vulnerabilities.HIGH + vulnerabilities.CRITICAL > 0) {
				errors.push('HIGH or CRITICAL vulnerabilities found');
			}
		} catch (error) {
			errors.push(error.message);
		}
		try {
			validateSarif(join(directory, `trivy-${arch}.sarif`));
		} catch (error) {
			errors.push(error.message);
		}
		return { platform, vulnerabilities, errors };
	});
	return { passed: results.every((result) => result.errors.length === 0), results };
}

function prepareReports(directory, platforms) {
	mkdirSync(directory, { recursive: true });
	const scans = {};
	for (const platform of platforms) {
		const arch = platform.split('/')[1];
		scans[arch] = { scan: process.env[`${arch.toUpperCase()}_SCAN_OUTCOME`] ?? 'missing' };
		try {
			const jsonPath = join(directory, `trivy-${arch}.json`);
			readScan(jsonPath, arch);
			execFileSync(
				'trivy',
				[
					'convert',
					'--format',
					'sarif',
					'--severity',
					severities.join(','),
					'--output',
					join(directory, `trivy-${arch}.sarif`),
					jsonPath
				],
				{ stdio: 'inherit', timeout: 60_000 }
			);
			validateSarif(join(directory, `trivy-${arch}.sarif`));
			scans[arch].conversion = 'success';
		} catch (error) {
			scans[arch].conversion = 'failure';
			console.error(`${platform}: ${error.message}`);
		}
	}
	writeFileSync(join(directory, 'scan-status.json'), JSON.stringify({ platforms, scans }, null, 2));
	writeFileSync(
		join(directory, 'summary.json'),
		JSON.stringify(evaluateReports(directory, platforms), null, 2)
	);
	// Defer failure until CI has uploaded every available report.
}

try {
	const [mode, directory, selectedPlatforms] = process.argv.slice(2);
	const platforms = selectedPlatforms?.split(',');
	requireValue(
		['prepare', 'gate'].includes(mode) &&
			directory &&
			platforms?.length > 0 &&
			new Set(platforms).size === platforms.length &&
			platforms.every((platform) => ['linux/amd64', 'linux/arm64'].includes(platform)),
		'Usage: node scripts/image-security.mjs prepare|gate <report-directory> <platforms>'
	);
	if (mode === 'prepare') {
		prepareReports(directory, platforms);
	} else {
		const summary = evaluateReports(directory, platforms);
		console.log(JSON.stringify(summary, null, 2));
		process.exitCode = summary.passed ? 0 : 1;
	}
} catch (error) {
	console.error(error.message);
	process.exitCode = 1;
}
