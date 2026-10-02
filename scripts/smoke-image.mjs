#!/usr/bin/env node
/* oxlint-disable no-console -- CLI progress and diagnostics belong on stdout/stderr. */
import { execFileSync, spawn } from 'node:child_process';
import { chmodSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomBytes } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';
import { isDeepStrictEqual } from 'node:util';
import { chromium } from 'playwright';
import { parseAllDocuments } from 'yaml';

const timeoutMs = 120_000;
const owned = {
	container: '',
	cluster: '',
	kubeconfig: '',
	portForward: undefined,
	children: new Set()
};
let tempDir;
let browser;
let cleanupPromise;
let interrupted = false;
let requestedExitCode;
const cleanupErrors = [];
const sensitiveValues = new Set();

function redact(value) {
	let message = String(value);
	for (const secret of sensitiveValues) {
		if (secret) message = message.replaceAll(secret, '[REDACTED]');
	}
	return message;
}

function fail(message) {
	throw new Error(redact(message));
}

function parseArgs(args) {
	const parsed = {};
	for (let index = 0; index < args.length; index += 1) {
		const arg = args[index];
		if (arg === '--help' || arg === '-h') {
			console.log(
				'Usage: pnpm smoke:image --image <existing-local-image> --platform linux/amd64|linux/arm64'
			);
			process.exit(0);
		}
		if (arg !== '--image' && arg !== '--platform') fail(`Unknown option: ${arg}`);
		const value = args[index + 1];
		if (!value || value.startsWith('--')) fail(`Missing value for ${arg}`);
		parsed[arg.slice(2)] = value;
		index += 1;
	}
	if (!parsed.image) fail('--image is required');
	if (!['linux/amd64', 'linux/arm64'].includes(parsed.platform)) {
		fail('--platform must be linux/amd64 or linux/arm64');
	}
	return parsed;
}

function run(command, args, options = {}) {
	try {
		return String(
			execFileSync(command, args, {
				encoding: 'utf8',
				stdio: ['ignore', 'pipe', 'pipe'],
				timeout: 60_000,
				maxBuffer: 8 * 1024 * 1024,
				...options
			})
		).trim();
	} catch (error) {
		const detail = error.stderr?.toString().trim();
		fail(`${command} ${args.join(' ')} failed${detail ? `: ${detail}` : ''}`);
	}
}

function runAsync(command, args, options = {}) {
	if (interrupted && !options.cleanup) return Promise.reject(new Error('Smoke run interrupted'));
	return new Promise((resolve, reject) => {
		const { timeout = 300_000, input, cleanup: cleanupCommand = false, ...spawnOptions } = options;
		if (interrupted && !cleanupCommand) return reject(new Error('Smoke run interrupted'));
		const child = spawn(command, args, {
			...spawnOptions,
			stdio: [input === undefined ? 'ignore' : 'pipe', 'pipe', 'pipe']
		});
		if (input !== undefined) child.stdin.end(input);
		owned.children.add(child);
		let stdout = '';
		let stderr = '';
		let settled = false;
		let timedOut = false;
		const limit = 8 * 1024 * 1024;
		let killTimer;
		const timer = setTimeout(() => {
			timedOut = true;
			child.kill('SIGTERM');
			killTimer = setTimeout(() => child.kill('SIGKILL'), 5000);
		}, timeout);
		child.stdout.on('data', (chunk) => {
			if (stdout.length < limit) stdout += chunk.toString().slice(0, limit - stdout.length);
		});
		child.stderr.on('data', (chunk) => {
			if (stderr.length < limit) stderr += chunk.toString().slice(0, limit - stderr.length);
		});
		child.once('error', (error) => {
			if (settled) return;
			settled = true;
			clearTimeout(timer);
			clearTimeout(killTimer);
			owned.children.delete(child);
			reject(new Error(`${command} ${args.join(' ')} could not start: ${error.message}`));
		});
		child.once('close', (code) => {
			if (settled) return;
			settled = true;
			clearTimeout(timer);
			clearTimeout(killTimer);
			owned.children.delete(child);
			if (code === 0) resolve(stdout.trim());
			else {
				const detail = stderr.trim().slice(-4000);
				reject(
					new Error(
						`${command} ${args.join(' ')} ${timedOut ? `timed out after ${timeout}ms` : `exited ${code}`}${detail ? `: ${detail}` : ''}`
					)
				);
			}
		});
	});
}

function randomSecret(bytes = 32) {
	const secret = randomBytes(bytes).toString('hex');
	sensitiveValues.add(secret);
	return secret;
}

function rememberSecret(secret) {
	sensitiveValues.add(secret);
	return secret;
}

function assert(condition, message) {
	if (!condition) fail(message);
}

function isExpectedBrowserConsoleError(text) {
	const themeHashes = [
		"'sha256-/DyTma9KXn1rez0gDs6P3sfoope221MB2e46LALMDW0='",
		"'sha256-pxdUlB9JMpOWW09wcB3QtaLDae+BDrLB5I0FwOK5qsM='"
	];
	const blockedThemeScript =
		text.startsWith(
			'Executing inline script violates the following Content Security Policy directive'
		) &&
		text.includes("script-src 'self' 'nonce-") &&
		themeHashes.some((hash) => text.includes(hash)) &&
		text.includes('The action has been blocked.');
	const blockedKnownFontStylesheet =
		text.startsWith(
			"Loading the stylesheet 'https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:"
		) &&
		text.includes('family=JetBrains+Mono:') &&
		text.includes('family=Inter:') &&
		text.includes('violates the following Content Security Policy directive') &&
		text.includes('The action has been blocked.');
	return blockedThemeScript || blockedKnownFontStylesheet;
}

async function waitFor(check, message, timeout = timeoutMs) {
	const end = Date.now() + timeout;
	while (Date.now() < end) {
		if (interrupted) fail('Smoke run interrupted');
		if (await check()) return;
		await delay(1000);
	}
	fail(message);
}

async function getWithTimeout(url) {
	return fetch(url, { signal: AbortSignal.timeout(4000) });
}

async function checkLocalImage(image, platform) {
	let inspectedPlatform;
	try {
		inspectedPlatform = run('docker', [
			'image',
			'inspect',
			image,
			'--format',
			'{{.Os}}/{{.Architecture}}'
		]);
	} catch (error) {
		fail(
			`Could not inspect local Docker image ${image}: ${error instanceof Error ? error.message : String(error)}`
		);
	}
	assert(
		inspectedPlatform === platform,
		`Local image ${image} has platform ${inspectedPlatform}, expected ${platform}`
	);
}

async function runtimeAndBrowser(image, platform) {
	owned.container = `gyre-smoke-${process.pid}-${randomSecret(4)}`;
	tempDir = mkdtempSync(join(tmpdir(), 'gyre-smoke-'));
	chmodSync(tempDir, 0o700);
	const adminPassword = rememberSecret(`Smoke-${randomSecret(18)}!aA1`);
	const envPath = join(tempDir, 'runtime.env');
	writeFileSync(
		envPath,
		[
			`ADMIN_PASSWORD=${adminPassword}`,
			`AUTH_ENCRYPTION_KEY=${randomSecret()}`,
			`GYRE_ENCRYPTION_KEY=${randomSecret()}`,
			`BACKUP_ENCRYPTION_KEY=${randomSecret()}`,
			`BETTER_AUTH_SECRET=${randomSecret()}`,
			`GYRE_METRICS_TOKEN=${randomSecret()}`,
			`GYRE_SETTLING_PERIOD_MS=0`,
			`GYRE_POLL_INTERVAL_MS=1000`
		].join('\n') + '\n',
		{ mode: 0o600 }
	);
	run('docker', [
		'run',
		'-d',
		'--name',
		owned.container,
		'--platform',
		platform,
		'--env-file',
		envPath,
		'-p',
		'127.0.0.1::3000',
		image
	]);
	const port = run('docker', ['port', owned.container, '3000/tcp']).split(':').at(-1);
	assert(port && /^\d+$/.test(port), 'Docker did not publish the app port');
	const baseUrl = `http://127.0.0.1:${port}`;
	await waitFor(async () => {
		const running = run('docker', ['inspect', '--format', '{{.State.Running}}', owned.container]);
		if (running !== 'true') fail('Application container stopped before becoming healthy');
		const health = await getWithTimeout(`${baseUrl}/api/v1/health`).catch(() => null);
		return health?.status === 200;
	}, 'Image health endpoint did not become ready');
	assert(
		run('docker', ['exec', owned.container, 'id', '-u']) === '1001',
		'Application is not running as UID 1001'
	);
	const architecture = platform.endsWith('/amd64') ? 'x64' : 'arm64';
	const nativeCheck = `if(process.arch!==${JSON.stringify(architecture)})throw Error('wrong Node architecture');const D=require('better-sqlite3');const db=new D('/tmp/smoke-native.db');db.exec('CREATE TABLE smoke_image_check(value TEXT NOT NULL)');db.prepare('INSERT INTO smoke_image_check(value) VALUES (?)').run('native-sqlite-ok');if(db.prepare('SELECT value FROM smoke_image_check').get()?.value!=='native-sqlite-ok')throw Error('native SQLite read/write failed');db.close();`;
	try {
		run('docker', ['exec', owned.container, 'node', '-e', nativeCheck]);
	} catch {
		fail(`Native SQLite scratch read/write failed for ${platform}`);
	}
	console.log(`Runtime health, UID 1001, and native SQLite passed for ${platform}.`);

	browser = await chromium.launch({ headless: true });
	const context = await browser.newContext();
	const page = await context.newPage();
	const browserErrors = [];
	const productionAssetResponses = [];
	const loginStatuses = [];
	let passwordChangeRequestStartedAt;
	let passwordChangeResponse;
	let passwordChangeResponseBody = Promise.resolve();
	page.on('pageerror', (error) => browserErrors.push(error.message));
	page.on('console', (message) => {
		if (message.type() !== 'error') return;
		const text = message.text();
		if (!isExpectedBrowserConsoleError(text)) browserErrors.push(text);
	});
	page.on('requestfailed', (request) => {
		const requestUrl = new URL(request.url());
		if (requestUrl.origin === baseUrl || requestUrl.pathname.startsWith('/_app/')) {
			browserErrors.push(`${request.method()} ${request.url()} failed`);
		}
	});
	page.on('request', (request) => {
		const requestUrl = new URL(request.url());
		if (request.method() === 'POST' && requestUrl.pathname === '/api/v1/auth/change-password') {
			passwordChangeRequestStartedAt = Date.now();
		}
	});
	page.on('response', (response) => {
		const responseUrl = new URL(response.url());
		if (
			response.request().method() === 'POST' &&
			responseUrl.pathname === '/api/v1/auth/change-password'
		) {
			passwordChangeResponse = {
				status: response.status(),
				elapsedMs:
					passwordChangeRequestStartedAt === undefined
						? null
						: Date.now() - passwordChangeRequestStartedAt,
				errorMessage: undefined
			};
			if (!response.ok()) {
				passwordChangeResponseBody = response
					.text()
					.then((body) => {
						try {
							const payload = JSON.parse(body);
							let message;
							if (typeof payload?.message === 'string') message = payload.message;
							else if (typeof payload?.message?.message === 'string') {
								message = payload.message.message;
							}
							if (message) passwordChangeResponse.errorMessage = redact(message).slice(0, 500);
						} catch {
							// The status remains useful when an error response is not JSON.
						}
					})
					.catch(() => {});
			}
		}
		if (responseUrl.pathname === '/api/v1/auth/login') loginStatuses.push(response.status());
		if (responseUrl.pathname.startsWith('/_app/')) {
			const pathname = responseUrl.pathname;
			const contentType = response.headers()['content-type'] ?? '';
			productionAssetResponses.push({ status: response.status(), contentType, pathname });
			let expectedMime;
			if (pathname.endsWith('.js')) expectedMime = /javascript/;
			else if (pathname.endsWith('.css')) expectedMime = /text\/css/;
			if (response.status() < 200 || response.status() >= 300) {
				browserErrors.push(`production asset returned ${response.status()}: ${pathname}`);
			} else if (expectedMime && !expectedMime.test(contentType)) {
				browserErrors.push(
					`production asset had unexpected MIME ${contentType || 'missing'}: ${pathname}`
				);
			}
		}
	});
	const reportPasswordChangeFailure = async (stage, error) => {
		let responseBodyWaitTimer;
		await Promise.race([
			passwordChangeResponseBody,
			new Promise((resolve) => {
				responseBodyWaitTimer = setTimeout(resolve, 4_000);
			})
		]).finally(() => clearTimeout(responseBodyWaitTimer));
		const visiblePageText = redact(
			(
				await page
					.locator('body')
					.innerText({ timeout: 1_000 })
					.catch(() => 'unavailable')
			).trim()
		).slice(0, 600);
		const changePasswordButton = page.getByRole('button', { name: /Change Password|Updating/ });
		const buttonState =
			(await changePasswordButton.count()) === 0
				? 'missing'
				: `text=${redact((await changePasswordButton.innerText({ timeout: 1_000 }).catch(() => 'unavailable')).trim()).slice(0, 80)}, disabled=${await changePasswordButton.isDisabled({ timeout: 1_000 }).catch(() => 'unknown')}`;
		let responseDetails;
		if (passwordChangeResponse) {
			responseDetails = `status=${passwordChangeResponse.status}, elapsed=${passwordChangeResponse.elapsedMs ?? 'unknown'}ms${passwordChangeResponse.errorMessage ? `, error=${passwordChangeResponse.errorMessage}` : ''}`;
		} else if (passwordChangeRequestStartedAt === undefined) {
			responseDetails = 'request not sent';
		} else {
			responseDetails = `request sent, pending for ${Date.now() - passwordChangeRequestStartedAt}ms`;
		}
		fail(
			`${stage} (${error instanceof Error ? error.message : String(error)}; API ${responseDetails}; URL ${page.url()}; page: ${visiblePageText || 'empty'}; button: ${buttonState}; browser/request errors: ${browserErrors.join('; ') || 'none'})`
		);
	};

	await waitFor(async () => {
		const response = await getWithTimeout(`${baseUrl}/login`).catch(() => null);
		if (!response) return false;
		if (response.status === 503) return false;
		return response.status === 200 && (await response.text()).includes('id="username"');
	}, 'Login page did not become ready');
	await page.goto(`${baseUrl}/login`, { waitUntil: 'networkidle' });
	await page.locator('#username').fill('admin');
	await page.locator('#password').fill(adminPassword);
	await page.getByRole('button', { name: 'Sign In' }).click();
	try {
		await page.getByRole('heading', { name: 'Change Password' }).waitFor({ timeout: 15_000 });
	} catch {
		const visibleState = (await page.locator('body').innerText()).slice(0, 400);
		fail(
			`First login did not reach password change (login status ${loginStatuses.join(',') || 'missing'}; assets ${productionAssetResponses.join(',') || 'none'}; browser errors ${browserErrors.join('; ') || 'none'}; URL ${page.url()}; page: ${visibleState})`
		);
	}
	await page.waitForLoadState('networkidle');
	assert(
		await page.getByText('Account Activated').isVisible(),
		'First-login password rotation was not required'
	);
	const changedPassword = rememberSecret(`Smoke-${randomSecret(18)}!bB2`);
	await page.getByLabel('Current Password').fill(adminPassword);
	await page.getByLabel('New Password', { exact: true }).fill(changedPassword);
	await page.getByLabel('Confirm New Password', { exact: true }).fill(changedPassword);
	let passwordChangeApiResponse;
	try {
		[passwordChangeApiResponse] = await Promise.all([
			page.waitForResponse(
				(response) =>
					response.request().method() === 'POST' &&
					new URL(response.url()).origin === baseUrl &&
					new URL(response.url()).pathname === '/api/v1/auth/change-password',
				{ timeout: timeoutMs }
			),
			page.getByRole('button', { name: 'Change Password' }).click()
		]);
	} catch (error) {
		await reportPasswordChangeFailure(
			'Password-change API response did not arrive after submit',
			error
		);
	}
	if (passwordChangeApiResponse.status() !== 200) {
		await reportPasswordChangeFailure(
			`Password-change API returned unexpected HTTP ${passwordChangeApiResponse.status()}`,
			new Error('Expected HTTP 200')
		);
	}
	console.log(
		`Password-change API returned HTTP 200 in ${passwordChangeResponse?.elapsedMs ?? 'unknown'}ms.`
	);
	try {
		await page.waitForURL((url) => !url.pathname.startsWith('/change-password'), {
			timeout: 15_000
		});
	} catch (error) {
		await reportPasswordChangeFailure(
			'Password-change API succeeded but page navigation failed',
			error
		);
	}
	const passwordCheckContext = await browser.newContext();
	const oldPasswordResponse = await passwordCheckContext.request.post(
		`${baseUrl}/api/v1/auth/login`,
		{
			data: { username: 'admin', password: adminPassword }
		}
	);
	assert(oldPasswordResponse.status() === 401, 'Old password was accepted after password rotation');
	const newPasswordResponse = await passwordCheckContext.request.post(
		`${baseUrl}/api/v1/auth/login`,
		{
			data: { username: 'admin', password: changedPassword }
		}
	);
	assert(newPasswordResponse.ok(), 'Changed password was rejected by a fresh login request');
	await passwordCheckContext.close();
	const databaseCheck =
		"const D=require('better-sqlite3');const app=new D('/data/gyre.db',{readonly:true});const r=app.prepare('PRAGMA integrity_check').get();if(r.integrity_check!=='ok')throw Error('application database integrity check failed');app.close();";
	run('docker', ['exec', owned.container, 'node', '-e', databaseCheck]);
	console.log(`Application database integrity passed for ${platform}.`);
	await page.goto(`${baseUrl}/admin/settings`, { waitUntil: 'domcontentloaded' });
	await page.waitForLoadState('networkidle');
	await page.getByLabel('Audit Log Retention (Days)').waitFor();
	await page.getByLabel('Audit Log Retention (Days)').fill('91');
	const settingsSave = page.waitForResponse(
		(response) =>
			new URL(response.url()).pathname === '/api/v1/admin/settings' &&
			response.request().method() === 'PATCH'
	);
	await page.getByRole('button', { name: 'Save Settings' }).click();
	const savedSettingsResponse = await settingsSave;
	assert(savedSettingsResponse.status() === 200, 'Settings save request failed');
	const savedSettingsPayload = await savedSettingsResponse.json();
	assert(
		savedSettingsPayload.settings?.auditRetentionDays?.value === 91,
		'Settings response omitted the saved audit retention value'
	);
	await page.reload({ waitUntil: 'domcontentloaded' });
	await page.waitForLoadState('networkidle');
	const reloadedRetention = await page.getByLabel('Audit Log Retention (Days)').inputValue();
	assert(
		reloadedRetention === '91',
		`Settings did not persist after reload (value ${reloadedRetention})`
	);
	assert(
		productionAssetResponses.some((response) => response.pathname.endsWith('.js')),
		'No production JavaScript asset was loaded'
	);
	assert(
		productionAssetResponses.some((response) => response.pathname.endsWith('.css')),
		'No production CSS asset was loaded'
	);
	assert(browserErrors.length === 0, `Browser errors: ${browserErrors.join('; ')}`);
	await context.close();
	await browser.close();
	browser = undefined;
	console.log(
		'Chromium login, first-password change, settings persistence, and production assets passed.'
	);
	run('docker', ['rm', '-f', owned.container]);
	owned.container = '';
	return { adminPassword };
}

async function clusterAndFlux(image, platform) {
	const suffix = `${process.pid}-${randomSecret(3)}`.toLowerCase();
	const clusterName = `gyre-smoke-${suffix}`;
	const namespace = `gyre-smoke-${suffix}`;
	const kubeconfigPath = join(tempDir, 'kind.kubeconfig');
	owned.cluster = clusterName;
	owned.kubeconfig = kubeconfigPath;
	console.log(`Creating disposable Kind cluster for ${platform}.`);
	await runAsync(
		'kind',
		[
			'create',
			'cluster',
			'--name',
			clusterName,
			'--image',
			'kindest/node:v1.36.1',
			'--wait',
			'180s',
			'--kubeconfig',
			kubeconfigPath
		],
		{ timeout: 360_000 }
	);
	chmodSync(kubeconfigPath, 0o600);
	const kubectl = (args, options = {}) =>
		runAsync('kubectl', ['--kubeconfig', kubeconfigPath, ...args], options);
	const fluxEnv = { ...process.env, KUBECONFIG: kubeconfigPath };
	await runAsync('kind', ['load', 'docker-image', image, '--name', clusterName], {
		timeout: 360_000
	});
	const fluxManifests = await runAsync(
		'flux',
		[
			'install',
			'--export',
			'--namespace=flux-system',
			'--components=source-controller,kustomize-controller,helm-controller',
			'--network-policy=false'
		],
		{ env: fluxEnv, timeout: 60_000 }
	);
	const fluxCrds = parseAllDocuments(fluxManifests)
		.map((document) => document.toJSON())
		.filter((resource) => resource?.kind === 'CustomResourceDefinition');
	assert(fluxCrds.length >= 4, `Flux export contained only ${fluxCrds.length} CRDs`);
	await kubectl(['apply', '--server-side', '-f', '-'], {
		input: fluxCrds.map(JSON.stringify).join('\n---\n')
	});
	await kubectl(['create', 'namespace', 'flux-system']);
	for (const crd of [
		'gitrepositories.source.toolkit.fluxcd.io',
		'helmrepositories.source.toolkit.fluxcd.io',
		'kustomizations.kustomize.toolkit.fluxcd.io',
		'helmreleases.helm.toolkit.fluxcd.io'
	]) {
		await kubectl(['wait', '--for=condition=Established', `crd/${crd}`, '--timeout=120s'], {
			timeout: 130_000
		});
	}
	await kubectl(['create', 'namespace', namespace]);
	await kubectl(['create', 'serviceaccount', 'gyre-smoke', '-n', namespace]);
	const appRoleBinding = {
		apiVersion: 'rbac.authorization.k8s.io/v1',
		kind: 'ClusterRoleBinding',
		metadata: { name: `gyre-smoke-admin-${suffix}` },
		roleRef: { apiGroup: 'rbac.authorization.k8s.io', kind: 'ClusterRole', name: 'cluster-admin' },
		subjects: [{ kind: 'ServiceAccount', name: 'gyre-smoke', namespace }]
	};
	await kubectl(['apply', '-f', '-'], { input: JSON.stringify(appRoleBinding) });
	const clusterPassword = rememberSecret(`Smoke-${randomSecret(18)}!cC3`);
	const keyEnv =
		[
			`ADMIN_PASSWORD=${clusterPassword}`,
			`AUTH_ENCRYPTION_KEY=${randomSecret()}`,
			`GYRE_ENCRYPTION_KEY=${randomSecret()}`,
			`BACKUP_ENCRYPTION_KEY=${randomSecret()}`,
			`BETTER_AUTH_SECRET=${randomSecret()}`,
			`GYRE_METRICS_TOKEN=${randomSecret()}`
		].join('\n') + '\n';
	const secretEnvPath = join(tempDir, 'cluster.env');
	writeFileSync(secretEnvPath, keyEnv, { mode: 0o600 });
	await kubectl([
		'create',
		'secret',
		'generic',
		'gyre-smoke-secrets',
		'-n',
		namespace,
		`--from-env-file=${secretEnvPath}`
	]);

	const archiveDir = join(tempDir, 'flux-artifact');
	const archivePath = join(tempDir, 'flux-artifact.tar.gz');
	const artifacts = [
		'apiVersion: kustomize.config.k8s.io/v1beta1\nkind: Kustomization\nresources:\n  - desired.yaml\n  - invalid.yaml\n',
		JSON.stringify(
			{
				apiVersion: 'apps/v1',
				kind: 'Deployment',
				metadata: { name: 'preview-target', namespace },
				spec: {
					replicas: 1,
					selector: { matchLabels: { app: 'preview-target' } },
					template: {
						metadata: { labels: { app: 'preview-target' } },
						spec: {
							containers: [{ name: 'app', image: 'nginx:1.27', ports: [{ containerPort: 8080 }] }]
						}
					}
				}
			},
			null,
			2
		),
		JSON.stringify(
			{
				apiVersion: 'apps/v1',
				kind: 'Deployment',
				metadata: { name: 'preview-invalid', namespace },
				spec: {
					selector: { matchLabels: { app: 'preview-invalid' } },
					replicas: -1,
					template: {
						metadata: { labels: { app: 'preview-invalid' } },
						spec: { containers: [{ name: 'app', image: 'nginx:1.27' }] }
					}
				}
			},
			null,
			2
		)
	];
	await runAsync('mkdir', ['-p', archiveDir]);
	writeFileSync(join(archiveDir, 'kustomization.yaml'), artifacts[0]);
	writeFileSync(join(archiveDir, 'desired.yaml'), artifacts[1]);
	writeFileSync(join(archiveDir, 'invalid.yaml'), artifacts[2]);
	await runAsync('tar', ['-czf', archivePath, '-C', archiveDir, '.']);
	await kubectl([
		'-n',
		'flux-system',
		'create',
		'configmap',
		'gyre-smoke-artifact',
		`--from-file=fixture.tar.gz=${archivePath}`
	]);
	const artifactServerSource = `const http=require('node:http'),fs=require('node:fs');http.createServer((_req,res)=>{res.writeHead(200,{'Content-Type':'application/gzip'});res.end(fs.readFileSync('/artifact/fixture.tar.gz'))}).listen(8080,'0.0.0.0');`;
	const artifactServer = {
		apiVersion: 'apps/v1',
		kind: 'Deployment',
		metadata: { name: 'gyre-smoke-artifact', namespace: 'flux-system' },
		spec: {
			replicas: 1,
			selector: { matchLabels: { app: 'gyre-smoke-artifact' } },
			template: {
				metadata: { labels: { app: 'gyre-smoke-artifact' } },
				spec: {
					containers: [
						{
							name: 'server',
							image,
							imagePullPolicy: 'Never',
							command: ['node', '-e', artifactServerSource],
							ports: [{ containerPort: 8080 }],
							volumeMounts: [{ name: 'artifact', mountPath: '/artifact', readOnly: true }]
						}
					],
					volumes: [{ name: 'artifact', configMap: { name: 'gyre-smoke-artifact' } }]
				}
			}
		}
	};
	const artifactService = {
		apiVersion: 'v1',
		kind: 'Service',
		metadata: { name: 'smoke-artifacts', namespace: 'flux-system' },
		spec: { selector: { app: 'gyre-smoke-artifact' }, ports: [{ port: 80, targetPort: 8080 }] }
	};
	await kubectl(['apply', '-f', '-'], {
		input: `${JSON.stringify(artifactServer)}\n---\n${JSON.stringify(artifactService)}`
	});
	await kubectl(
		['-n', 'flux-system', 'rollout', 'status', 'deployment/gyre-smoke-artifact', '--timeout=180s'],
		{ timeout: 210_000 }
	);
	const artifactUrl = 'http://smoke-artifacts.flux-system.svc.cluster.local/fixture.tar.gz';
	const sourceResource = {
		apiVersion: 'source.toolkit.fluxcd.io/v1',
		kind: 'GitRepository',
		metadata: { name: 'smoke-source', namespace },
		spec: { interval: '1h', url: 'https://example.invalid/gyre-smoke.git', suspend: true }
	};
	const diffKustomization = {
		apiVersion: 'kustomize.toolkit.fluxcd.io/v1',
		kind: 'Kustomization',
		metadata: { name: 'diff-fixture', namespace },
		spec: {
			interval: '1h',
			path: './',
			prune: false,
			suspend: true,
			sourceRef: { kind: 'GitRepository', name: 'smoke-source' }
		}
	};
	const liveDeployment = {
		apiVersion: 'apps/v1',
		kind: 'Deployment',
		metadata: { name: 'preview-target', namespace },
		spec: {
			replicas: 0,
			selector: { matchLabels: { app: 'preview-target' } },
			template: {
				metadata: { labels: { app: 'preview-target' } },
				spec: { containers: [{ name: 'app', image: 'nginx:1.26' }] }
			}
		}
	};
	await kubectl(['apply', '-f', '-'], {
		input: [sourceResource, diffKustomization, liveDeployment].map(JSON.stringify).join('\n---\n')
	});
	const artifactStatus = {
		artifact: {
			path: 'gyre-smoke/fixture.tar.gz',
			url: artifactUrl,
			revision: 'main@sha1:smoke0001',
			digest: `sha256:${'a'.repeat(64)}`,
			lastUpdateTime: new Date().toISOString()
		},
		conditions: [
			{
				type: 'Ready',
				status: 'True',
				reason: 'Succeeded',
				message: 'Disposable image smoke artifact',
				lastTransitionTime: new Date().toISOString()
			}
		]
	};
	await kubectl([
		'-n',
		namespace,
		'patch',
		'gitrepository',
		'smoke-source',
		'--subresource=status',
		'--type=merge',
		'-p',
		JSON.stringify({ status: artifactStatus })
	]);
	const appDeployment = {
		apiVersion: 'apps/v1',
		kind: 'Deployment',
		metadata: { name: 'gyre-smoke', namespace },
		spec: {
			replicas: 1,
			selector: { matchLabels: { app: 'gyre-smoke' } },
			template: {
				metadata: { labels: { app: 'gyre-smoke' } },
				spec: {
					serviceAccountName: 'gyre-smoke',
					securityContext: { runAsUser: 1001, runAsGroup: 1001, fsGroup: 1001 },
					containers: [
						{
							name: 'app',
							image,
							imagePullPolicy: 'Never',
							ports: [{ containerPort: 3000 }],
							envFrom: [{ secretRef: { name: 'gyre-smoke-secrets' } }],
							env: [
								{ name: 'FLUX_SOURCE_CONTROLLER_SERVICE', value: 'smoke-artifacts' },
								{ name: 'GYRE_SETTLING_PERIOD_MS', value: '0' },
								{ name: 'GYRE_POLL_INTERVAL_MS', value: '1000' }
							],
							readinessProbe: {
								httpGet: { path: '/api/v1/health', port: 3000 },
								initialDelaySeconds: 2,
								periodSeconds: 2
							}
						}
					],
					volumes: [{ name: 'data', emptyDir: {} }]
				}
			}
		}
	};
	appDeployment.spec.template.spec.containers[0].volumeMounts = [
		{ name: 'data', mountPath: '/data' }
	];
	const appService = {
		apiVersion: 'v1',
		kind: 'Service',
		metadata: { name: 'gyre-smoke', namespace },
		spec: { selector: { app: 'gyre-smoke' }, ports: [{ port: 3000, targetPort: 3000 }] }
	};
	await kubectl(['apply', '-f', '-'], {
		input: `${JSON.stringify(appDeployment)}\n---\n${JSON.stringify(appService)}`
	});
	await kubectl(['-n', namespace, 'rollout', 'status', 'deployment/gyre-smoke', '--timeout=240s'], {
		timeout: 270_000
	});
	console.log('Flux CRDs, source artifact fixture, and in-cluster application are ready.');

	const portForwardArgs = [
		'--kubeconfig',
		kubeconfigPath,
		'-n',
		namespace,
		'port-forward',
		'--address=127.0.0.1',
		'service/gyre-smoke',
		':3000'
	];
	owned.portForward = spawn('kubectl', portForwardArgs, { stdio: ['ignore', 'pipe', 'pipe'] });
	owned.children.add(owned.portForward);
	let forwardedPort = '';
	owned.portForward.stdout.on('data', (chunk) => {
		const match = /127\.0\.0\.1:(\d+)\s+->\s+3000/.exec(chunk.toString());
		if (match) forwardedPort = match[1];
	});
	owned.portForward.once('close', () => owned.children.delete(owned.portForward));
	await waitFor(
		() => Boolean(forwardedPort),
		'Could not establish the in-cluster application port-forward'
	);
	const baseUrl = `http://127.0.0.1:${forwardedPort}`;
	await waitFor(
		async () =>
			(await getWithTimeout(`${baseUrl}/api/v1/health`).catch(() => null))?.status === 200,
		'In-cluster application health check failed'
	);

	browser = await chromium.launch({ headless: true });
	const context = await browser.newContext();
	const page = await context.newPage();
	const browserErrors = [];
	let expectedForbiddenPath = '';
	let expectedForbiddenResponseSeen = false;
	let expectedForbiddenConsoleSeen = false;
	page.on('pageerror', (error) => browserErrors.push(error.message));
	page.on('response', (response) => {
		if (
			expectedForbiddenPath &&
			new URL(response.url()).pathname === expectedForbiddenPath &&
			response.status() === 403
		)
			expectedForbiddenResponseSeen = true;
	});
	page.on('requestfailed', (request) => {
		if (new URL(request.url()).origin === baseUrl)
			browserErrors.push(`${request.method()} ${request.url()} failed`);
	});
	page.on('console', (message) => {
		if (message.type() !== 'error') return;
		const text = message.text();
		const expectedPermissionDenial =
			expectedForbiddenResponseSeen &&
			!expectedForbiddenConsoleSeen &&
			text.startsWith('Failed to load resource:') &&
			text.includes('403');
		if (expectedPermissionDenial) expectedForbiddenConsoleSeen = true;
		else if (!isExpectedBrowserConsoleError(text)) browserErrors.push(text);
	});
	await waitFor(async () => {
		const response = await getWithTimeout(`${baseUrl}/login`).catch(() => null);
		if (!response || response.status === 503) return false;
		return response.status === 200 && (await response.text()).includes('id="username"');
	}, 'In-cluster login page did not become ready');
	await page.goto(`${baseUrl}/login`, { waitUntil: 'networkidle' });
	await page.locator('#username').fill('admin');
	await page.locator('#password').fill(clusterPassword);
	await page.getByRole('button', { name: 'Sign In' }).click();
	await page.waitForURL((url) => !url.pathname.startsWith('/login'), { timeout: 20_000 });
	assert(
		!page.url().includes('/change-password'),
		'In-cluster first login unexpectedly required password rotation'
	);
	await page.evaluate(() => {
		window.__gyreSmokeEvents = [];
		window.__gyreSmokeSource = new EventSource('/api/v1/events');
		window.__gyreSmokeSource.onmessage = (event) =>
			window.__gyreSmokeEvents.push(JSON.parse(event.data));
	});
	await page.waitForFunction(
		() => window.__gyreSmokeSource?.readyState === EventSource.OPEN,
		undefined,
		{ timeout: 30_000 }
	);

	const api = async (path, { method = 'GET', body } = {}) => {
		return page.evaluate(
			async ({ requestPath, requestMethod, requestBody }) => {
				const csrf =
					document.cookie
						.split('; ')
						.find((cookie) => cookie.startsWith('gyre_csrf='))
						?.slice('gyre_csrf='.length) ?? '';
				if (requestMethod !== 'GET' && !csrf)
					throw new Error('CSRF token is missing from the authenticated browser session');
				const response = await fetch(requestPath, {
					method: requestMethod,
					credentials: 'same-origin',
					...(requestBody === undefined ? {} : { body: JSON.stringify(requestBody) }),
					headers: {
						...(requestBody === undefined ? {} : { 'Content-Type': 'application/json' }),
						...(requestMethod === 'GET' ? {} : { 'X-CSRF-Token': csrf })
					}
				});
				const raw = await response.text();
				let payload;
				try {
					payload = JSON.parse(raw);
				} catch {
					payload = raw;
				}
				return { status: response.status, payload };
			},
			{ requestPath: path, requestMethod: method, requestBody: body }
		);
	};
	const clusterSelection = await api('/api/v1/user/cluster');
	assert(
		clusterSelection.status === 200,
		`In-cluster browser login did not establish an authenticated API session (HTTP ${clusterSelection.status})`
	);
	const waitForSse = async (type, name, { revision, readyStatus } = {}) =>
		page.waitForFunction(
			({ expectedType, expectedName, expectedRevision, expectedReadyStatus, expectedNamespace }) =>
				window.__gyreSmokeEvents?.some(
					(event) =>
						event.type === expectedType &&
						event.clusterId === 'in-cluster' &&
						event.resourceType === 'Kustomization' &&
						event.resource?.metadata?.namespace === expectedNamespace &&
						event.resource?.metadata?.name === expectedName &&
						(!expectedRevision ||
							event.resource?.status?.lastAppliedRevision === expectedRevision) &&
						(!expectedReadyStatus ||
							event.resource?.status?.conditions?.some(
								(condition) =>
									condition.type === 'Ready' && condition.status === expectedReadyStatus
							))
				),
			{
				expectedType: type,
				expectedName: name,
				expectedRevision: revision,
				expectedReadyStatus: readyStatus,
				expectedNamespace: namespace
			},
			{ timeout: 30_000 }
		);
	const actionFixture = {
		apiVersion: 'kustomize.toolkit.fluxcd.io/v1',
		kind: 'Kustomization',
		metadata: { name: 'action-fixture', namespace },
		spec: {
			interval: '1h',
			path: './',
			prune: false,
			suspend: false,
			sourceRef: { kind: 'GitRepository', name: 'smoke-source' }
		}
	};
	await kubectl(['apply', '-f', '-'], { input: JSON.stringify(actionFixture) });
	const initialActionSpec = JSON.parse(
		await kubectl(['-n', namespace, 'get', 'kustomization', 'action-fixture', '-o', 'json'])
	);
	await kubectl([
		'-n',
		namespace,
		'patch',
		'kustomization',
		'action-fixture',
		'--subresource=status',
		'--type=merge',
		'-p',
		JSON.stringify({
			status: {
				lastAppliedRevision: 'main@sha1:smoke0001',
				observedGeneration: 1,
				conditions: [
					{
						type: 'Ready',
						status: 'True',
						reason: 'Succeeded',
						message: 'Initial smoke state',
						lastTransitionTime: new Date().toISOString()
					}
				]
			}
		})
	]);
	await waitForSse('ADDED', 'action-fixture', {
		revision: 'main@sha1:smoke0001',
		readyStatus: 'True'
	});
	let history = await api(`/api/v1/flux/kustomizations/${namespace}/action-fixture/history`);
	if (history.status !== 200 || !history.payload.timeline?.length) {
		const appLogs = await kubectl([
			'-n',
			namespace,
			'logs',
			'deployment/gyre-smoke',
			'--tail=500'
		]).catch(() => '');
		const trackerErrors = appLogs
			.split('\n')
			.filter((line) =>
				/ReconciliationTracker|EventBus.*(error|failed)|SQLITE|database/i.test(line)
			)
			.join('\n')
			.slice(-2500);
		fail(
			`Real SSE ADDED event did not produce public reconciliation history (HTTP ${history.status}, payload ${JSON.stringify(history.payload)}, tracker logs ${trackerErrors || 'none'})`
		);
	}
	const originalHistory = history.payload.timeline.find(
		(entry) =>
			entry.revision === 'main@sha1:smoke0001' &&
			entry.status === 'success' &&
			isDeepStrictEqual(JSON.parse(entry.specSnapshot ?? '{}'), initialActionSpec.spec)
	);
	assert(originalHistory, 'History did not capture the exact initial Kustomization spec');
	for (const action of ['suspend', 'resume', 'reconcile']) {
		const response = await api(
			`/api/v1/flux/kustomizations/${namespace}/action-fixture/${action}`,
			{ method: 'POST' }
		);
		assert(response.status === 200, `Flux ${action} request failed`);
		const current = JSON.parse(
			await kubectl(['-n', namespace, 'get', 'kustomization', 'action-fixture', '-o', 'json'])
		);
		if (action === 'suspend')
			assert(current.spec.suspend === true, 'Suspend did not update the Kubernetes resource');
		if (action === 'resume')
			assert(current.spec.suspend === false, 'Resume did not update the Kubernetes resource');
		if (action === 'reconcile')
			assert(
				current.metadata.annotations?.['reconcile.fluxcd.io/requestedAt'],
				'Reconcile did not set the Flux request annotation'
			);
	}
	await api(`/api/v1/flux/kustomizations/${namespace}/action-fixture/suspend`, { method: 'POST' });
	await kubectl([
		'-n',
		namespace,
		'patch',
		'kustomization',
		'action-fixture',
		'--type=merge',
		'-p',
		JSON.stringify({ spec: { path: './alternate' } })
	]);
	await kubectl([
		'-n',
		namespace,
		'patch',
		'kustomization',
		'action-fixture',
		'--subresource=status',
		'--type=merge',
		'-p',
		JSON.stringify({
			status: {
				lastAppliedRevision: 'main@sha1:smoke0002',
				observedGeneration: 2,
				conditions: [
					{
						type: 'Ready',
						status: 'False',
						reason: 'BuildFailed',
						message: 'Controlled history transition',
						lastTransitionTime: new Date().toISOString()
					}
				]
			}
		})
	]);
	await waitForSse('MODIFIED', 'action-fixture', {
		revision: 'main@sha1:smoke0002',
		readyStatus: 'False'
	});
	const failedActionSpec = JSON.parse(
		await kubectl(['-n', namespace, 'get', 'kustomization', 'action-fixture', '-o', 'json'])
	);
	history = await api(`/api/v1/flux/kustomizations/${namespace}/action-fixture/history`);
	const failureHistory = history.payload.timeline?.find(
		(entry) =>
			entry.revision === 'main@sha1:smoke0002' &&
			entry.status === 'failure' &&
			entry.readyReason === 'BuildFailed' &&
			isDeepStrictEqual(JSON.parse(entry.specSnapshot ?? '{}'), failedActionSpec.spec)
	);
	assert(
		history.status === 200 && failureHistory,
		'Real SSE MODIFIED event did not capture the controlled failure and exact spec snapshot'
	);
	const beforeDryRun = JSON.parse(
		await kubectl(['-n', namespace, 'get', 'kustomization', 'action-fixture', '-o', 'json'])
	);
	const rollbackPreview = await api(
		`/api/v1/flux/kustomizations/${namespace}/action-fixture/rollback`,
		{
			method: 'POST',
			body: { historyId: originalHistory.id, dryRun: true }
		}
	);
	assert(
		rollbackPreview.status === 200 && rollbackPreview.payload.patch?.spec?.path === './',
		'Rollback dry-run did not preview the historical spec'
	);
	const afterDryRun = JSON.parse(
		await kubectl(['-n', namespace, 'get', 'kustomization', 'action-fixture', '-o', 'json'])
	);
	assert(
		JSON.stringify(afterDryRun.spec) === JSON.stringify(beforeDryRun.spec) &&
			afterDryRun.metadata.resourceVersion === beforeDryRun.metadata.resourceVersion,
		'Rollback dry-run changed Kubernetes spec or resourceVersion'
	);
	const rollback = await api(`/api/v1/flux/kustomizations/${namespace}/action-fixture/rollback`, {
		method: 'POST',
		body: { historyId: originalHistory.id }
	});
	assert(rollback.status === 200, 'Rollback apply request failed');
	const afterRollback = JSON.parse(
		await kubectl(['-n', namespace, 'get', 'kustomization', 'action-fixture', '-o', 'json'])
	);
	assert(afterRollback.spec.path === './', 'Rollback apply did not restore the historical spec');
	console.log('Flux suspend/resume/reconcile/rollback and SSE-backed history passed.');

	const beforePreview = JSON.parse(
		await kubectl(['-n', namespace, 'get', 'deployment', 'preview-target', '-o', 'json'])
	);
	const diffResponse = await api(
		`/api/v1/flux/kustomizations/${namespace}/diff-fixture/diff?force=true`
	);
	assert(diffResponse.status === 200, 'SSA preview request failed');
	const validDiff = diffResponse.payload.diffs?.find((diff) => diff.name === 'preview-target');
	const failedDiff = diffResponse.payload.diffs?.find((diff) => diff.name === 'preview-invalid');
	assert(
		validDiff &&
			!validDiff.error &&
			/replicas:\s*1/.test(validDiff.desired) &&
			/protocol:\s*TCP/.test(validDiff.desired),
		'SSA dry-run did not return desired values and Kubernetes defaults'
	);
	assert(
		failedDiff?.error && /replicas/i.test(failedDiff.error) && /-1/.test(failedDiff.error),
		'Invalid resource schema did not produce a per-resource SSA preview error'
	);
	const afterPreview = JSON.parse(
		await kubectl(['-n', namespace, 'get', 'deployment', 'preview-target', '-o', 'json'])
	);
	assert(
		JSON.stringify(afterPreview.spec) === JSON.stringify(beforePreview.spec) &&
			afterPreview.metadata.resourceVersion === beforePreview.metadata.resourceVersion,
		'SSA preview changed Kubernetes spec or resourceVersion'
	);
	const invalidExists = await kubectl([
		'-n',
		namespace,
		'get',
		'deployment',
		'preview-invalid',
		'--ignore-not-found=true',
		'-o',
		'name'
	]);
	assert(!invalidExists, 'Failed SSA preview created the invalid live resource');

	await page.goto(`${baseUrl}/resources/kustomizations/${namespace}/diff-fixture?tab=diff`, {
		waitUntil: 'domcontentloaded'
	});
	const invalidButton = page.getByRole('button').filter({ hasText: 'preview-invalid' });
	await invalidButton.getByText('Preview failed').waitFor({ timeout: 60_000 });
	await invalidButton.click();
	await page.getByRole('alert').getByText('Server-side dry-run failed').waitFor();
	const downloadPromise = page.waitForEvent('download');
	await page.getByRole('button', { name: 'Export drift report' }).click();
	const download = await downloadPromise;
	const exportPath = await download.path();
	assert(exportPath, 'Failed-preview export did not produce a file');
	const exported = readFileSync(exportPath, 'utf8');
	assert(
		exported.includes('Preview failed:') &&
			exported.includes('preview-invalid') &&
			exported.includes('replicas') &&
			exported.includes('-1'),
		'Drift export omitted the failed resource name or Kubernetes validation detail'
	);

	const readonlySa = 'gyre-smoke-readonly';
	await kubectl(['create', 'serviceaccount', readonlySa, '-n', namespace]);
	const readonlyRole = {
		apiVersion: 'rbac.authorization.k8s.io/v1',
		kind: 'ClusterRole',
		metadata: { name: readonlySa },
		rules: [{ apiGroups: ['*'], resources: ['*'], verbs: ['get', 'list', 'watch'] }]
	};
	const readonlyBinding = {
		apiVersion: 'rbac.authorization.k8s.io/v1',
		kind: 'ClusterRoleBinding',
		metadata: { name: readonlySa },
		roleRef: { apiGroup: 'rbac.authorization.k8s.io', kind: 'ClusterRole', name: readonlySa },
		subjects: [{ kind: 'ServiceAccount', name: readonlySa, namespace }]
	};
	await kubectl(['apply', '-f', '-'], {
		input: `${JSON.stringify(readonlyRole)}\n---\n${JSON.stringify(readonlyBinding)}`
	});
	const readonlyToken = rememberSecret(
		await kubectl(['-n', namespace, 'create', 'token', readonlySa, '--duration=1h'])
	);
	const currentConfig = JSON.parse(
		await kubectl(['config', 'view', '--raw', '--minify', '-o', 'json'])
	);
	const caData = currentConfig.clusters?.[0]?.cluster?.['certificate-authority-data'];
	assert(caData, 'Kind kubeconfig did not expose its API server certificate authority');
	const readOnlyKubeconfig = rememberSecret(
		[
			'apiVersion: v1',
			'kind: Config',
			'clusters:',
			'- name: smoke-cluster',
			'  cluster:',
			'    server: https://kubernetes.default.svc',
			`    certificate-authority-data: ${caData}`,
			'users:',
			'- name: smoke-readonly',
			'  user:',
			`    token: ${readonlyToken}`,
			'contexts:',
			'- name: smoke-readonly-context',
			'  context:',
			'    cluster: smoke-cluster',
			'    user: smoke-readonly',
			'current-context: smoke-readonly-context',
			''
		].join('\n')
	);
	let clusterPageEventsResponse;
	try {
		[clusterPageEventsResponse] = await Promise.all([
			page.waitForResponse(
				(response) => {
					const request = response.request();
					const eventUrl = new URL(response.url());
					const frame = request.frame();
					const frameUrl = new URL(frame.url());
					return (
						request.method() === 'GET' &&
						frame === page.mainFrame() &&
						frameUrl.origin === baseUrl &&
						frameUrl.pathname === '/admin/clusters' &&
						eventUrl.origin === baseUrl &&
						eventUrl.pathname === '/api/v1/events'
					);
				},
				{ timeout: 30_000 }
			),
			page.goto(`${baseUrl}/admin/clusters`, { waitUntil: 'domcontentloaded' })
		]);
	} catch (error) {
		const visiblePageText = redact(
			(
				await page
					.locator('body')
					.innerText({ timeout: 1_000 })
					.catch(() => 'unavailable')
			).trim()
		).slice(0, 600);
		fail(
			`Cluster page did not establish its authenticated event stream (${error instanceof Error ? error.message : String(error)}; URL ${page.url()}; page: ${visiblePageText || 'empty'}; browser/request errors: ${redact(browserErrors.join('; ') || 'none')})`
		);
	}
	const eventsContentType = clusterPageEventsResponse.headers()['content-type'] ?? '';
	assert(
		clusterPageEventsResponse.status() === 200,
		`Cluster page event stream returned HTTP ${clusterPageEventsResponse.status()}`
	);
	assert(
		/^text\/event-stream(?:\s*;|$)/i.test(eventsContentType),
		`Cluster page event stream had unexpected Content-Type ${eventsContentType || 'missing'}`
	);
	await page.getByRole('button', { name: 'Add Cluster' }).first().click();
	const createDialog = page.getByRole('dialog', { name: 'Add New Cluster' });
	try {
		await createDialog.waitFor({ state: 'visible', timeout: 10_000 });
	} catch (error) {
		const visiblePageText = redact(
			(
				await page
					.locator('body')
					.innerText({ timeout: 1_000 })
					.catch(() => 'unavailable')
			).trim()
		).slice(0, 600);
		fail(
			`Cluster creation dialog did not open (${error instanceof Error ? error.message : String(error)}; URL ${page.url()}; page: ${visiblePageText || 'empty'}; browser/request errors: ${redact(browserErrors.join('; ') || 'none')})`
		);
	}
	await createDialog.getByLabel('Cluster Name', { exact: true }).fill(`smoke-readonly-${suffix}`);
	await createDialog
		.getByLabel('Description (optional)', { exact: true })
		.fill('Disposable read-only RBAC verification');
	await createDialog.locator('#kubeconfig').fill(readOnlyKubeconfig);
	let clusterCreateRequestStartedAt;
	let clusterCreateActionDetails;
	const isClusterCreateActionRequest = (request) => {
		const requestUrl = new URL(request.url());
		return (
			request.method() === 'POST' &&
			requestUrl.origin === baseUrl &&
			requestUrl.pathname === '/admin/clusters' &&
			requestUrl.search === '?/create'
		);
	};
	page.on('request', (request) => {
		if (isClusterCreateActionRequest(request)) clusterCreateRequestStartedAt = Date.now();
	});
	const reportClusterCreateFailure = async (stage, error) => {
		const withDiagnosticTimeout = async (promise, timeout, fallback) => {
			let timer;
			return Promise.race([
				promise,
				new Promise((resolve) => {
					timer = setTimeout(() => resolve(fallback), timeout);
				})
			]).finally(() => clearTimeout(timer));
		};
		const readVisibleTextWithoutFormValues = async (locator, limit) =>
			redact(
				(
					await withDiagnosticTimeout(
						locator
							.evaluateAll((elements) => {
								const element = elements[0];
								if (!element) return '';
								const copy = element.cloneNode(true);
								copy.querySelectorAll('input, textarea, select').forEach((field) => field.remove());
								return copy.innerText || '';
							})
							.catch(() => 'unavailable'),
						1_000,
						'unavailable'
					)
				).trim()
			).slice(0, limit);
		const invalidFields = await withDiagnosticTimeout(
			createDialog
				.locator(':invalid')
				.evaluateAll((elements) =>
					elements.slice(0, 10).map((element) => ({
						name: element.getAttribute('name') || element.id || element.tagName.toLowerCase(),
						message: element.validationMessage
					}))
				)
				.catch(() => []),
			1_000,
			[]
		);
		const safeInvalidFields = invalidFields.map(({ name, message }) => ({
			name: redact(name).slice(0, 80),
			message: redact(message).slice(0, 160)
		}));
		const visiblePageText = await readVisibleTextWithoutFormValues(page.locator('body'), 600);
		const visibleDialogText = await readVisibleTextWithoutFormValues(createDialog, 400);
		let actionDetails = 'request not sent';
		if (clusterCreateActionDetails) {
			actionDetails = `HTTP ${clusterCreateActionDetails.status} after ${clusterCreateActionDetails.elapsedMs ?? 'unknown'}ms, action=${clusterCreateActionDetails.actionType || 'unknown'}/${clusterCreateActionDetails.actionStatus ?? 'unknown'}, success=${clusterCreateActionDetails.success === true}${clusterCreateActionDetails.message ? `, message=${clusterCreateActionDetails.message}` : ''}`;
		} else if (clusterCreateRequestStartedAt !== undefined) {
			actionDetails = `POST sent, response pending for ${Date.now() - clusterCreateRequestStartedAt}ms`;
		} else if (safeInvalidFields.length > 0) {
			actionDetails = 'browser constraint validation prevented the POST';
		}
		const browserInvalidState =
			safeInvalidFields.length > 0 ? JSON.stringify(safeInvalidFields) : 'none';
		fail(
			`${stage} (${redact(error instanceof Error ? error.message : String(error))}; action ${actionDetails}; invalid form fields: ${browserInvalidState}; URL ${page.url()}; page: ${visiblePageText || 'empty'}; dialog: ${visibleDialogText || 'unavailable'}; browser/request errors: ${redact(browserErrors.join('; ') || 'none')})`
		);
	};
	let clusterCreateActionResponse;
	try {
		[clusterCreateActionResponse] = await Promise.all([
			page.waitForResponse((response) => isClusterCreateActionRequest(response.request()), {
				timeout: timeoutMs
			}),
			createDialog.getByRole('button', { name: 'Add Cluster', exact: true }).click()
		]);
	} catch (error) {
		await reportClusterCreateFailure(
			'Cluster create action response did not arrive after submit',
			error
		);
	}
	clusterCreateActionDetails = {
		status: clusterCreateActionResponse.status(),
		elapsedMs:
			clusterCreateRequestStartedAt === undefined
				? null
				: Date.now() - clusterCreateRequestStartedAt,
		actionType: undefined,
		actionStatus: undefined,
		success: false,
		message: undefined
	};
	let actionBodyTimer;
	let actionBodyText;
	const actionBodyRead = clusterCreateActionResponse
		.text()
		.then((body) => {
			actionBodyText = body.length <= 65_536 ? body : undefined;
		})
		.catch(() => {});
	await Promise.race([
		actionBodyRead,
		new Promise((resolve) => {
			actionBodyTimer = setTimeout(resolve, 4_000);
		})
	]).finally(() => clearTimeout(actionBodyTimer));
	if (actionBodyText !== undefined) {
		try {
			const payload = JSON.parse(actionBodyText);
			if (['success', 'failure', 'error', 'redirect'].includes(payload.type)) {
				clusterCreateActionDetails.actionType = payload.type;
			}
			if (Number.isInteger(payload.status)) {
				clusterCreateActionDetails.actionStatus = payload.status;
			}
			let message;
			if (typeof payload.message === 'string') message = payload.message;
			else if (typeof payload.error?.message === 'string') message = payload.error.message;
			let actionData;
			if (typeof payload.data === 'string') {
				try {
					actionData = JSON.parse(payload.data);
				} catch {
					// The action type and HTTP status remain useful if data is not plain JSON.
				}
			}
			const rootScalar = (key) => {
				const reference = actionData?.[0]?.[key];
				if (Number.isInteger(reference) && reference >= 0 && reference < actionData.length) {
					const value = actionData[reference];
					if (value === null || ['string', 'boolean', 'number'].includes(typeof value))
						return value;
				}
				if (reference === null || ['string', 'boolean', 'number'].includes(typeof reference)) {
					return reference;
				}
				return undefined;
			};
			const actionError = rootScalar('error');
			if (typeof actionError === 'string') message = actionError;
			clusterCreateActionDetails.success =
				payload.type === 'success' &&
				clusterCreateActionDetails.actionStatus === 200 &&
				rootScalar('success') === true;
			if (message) clusterCreateActionDetails.message = redact(message).slice(0, 300);
		} catch {
			// Keep status and content type when a response is not JSON.
		}
	}
	if (clusterCreateActionResponse.status() !== 200 || clusterCreateActionDetails.success !== true) {
		await reportClusterCreateFailure(
			'Cluster create action did not report success',
			new Error('Expected HTTP 200 and a SvelteKit success result with success=true')
		);
	}
	console.log(
		`Cluster create action returned HTTP 200 success in ${clusterCreateActionDetails.elapsedMs ?? 'unknown'}ms.`
	);
	try {
		await createDialog.waitFor({ state: 'hidden', timeout: 60_000 });
	} catch (error) {
		await reportClusterCreateFailure(
			'Cluster create action succeeded but dialog did not close',
			error
		);
	}
	const selection = await api('/api/v1/user/cluster');
	const readonlyCluster = selection.payload.selectableClusters?.find(
		(cluster) => cluster.name === `smoke-readonly-${suffix}`
	);
	assert(readonlyCluster?.id, 'Read-only kubeconfig was not created through cluster management');
	const selected = await api('/api/v1/user/cluster', {
		method: 'PUT',
		body: { clusterId: readonlyCluster.id }
	});
	assert(selected.status === 200, 'Could not select uploaded read-only cluster credentials');
	const readableResource = await api(`/api/v1/flux/kustomizations/${namespace}/action-fixture`);
	assert(
		readableResource.status === 200 && readableResource.payload.metadata?.name === 'action-fixture',
		'Read-only credentials did not authenticate and read the Flux resource'
	);
	const beforeDenied = JSON.parse(
		await kubectl(['-n', namespace, 'get', 'kustomization', 'action-fixture', '-o', 'json'])
	);
	const readonlyDiff = await api(
		`/api/v1/flux/kustomizations/${namespace}/diff-fixture/diff?force=true`
	);
	const readonlyDiffs = readonlyDiff.payload.diffs ?? [];
	assert(
		readonlyDiff.status === 200 &&
			readonlyDiffs.length === 2 &&
			['preview-target', 'preview-invalid'].every((name) =>
				readonlyDiffs.some((diff) => diff.name === name && /forbidden/i.test(diff.error ?? ''))
			),
		'Read-only Kubernetes credentials did not surface SSA preview permission failures'
	);
	const deniedPath = `/api/v1/flux/kustomizations/${namespace}/action-fixture/suspend`;
	expectedForbiddenPath = deniedPath;
	const deniedMutation = await api(deniedPath, { method: 'POST' });
	assert(
		deniedMutation.status === 403 &&
			/permission denied/i.test(deniedMutation.payload.message ?? ''),
		`Read-only credentials mutation returned ${deniedMutation.status}, expected 403`
	);
	const afterDenied = JSON.parse(
		await kubectl(['-n', namespace, 'get', 'kustomization', 'action-fixture', '-o', 'json'])
	);
	assert(
		JSON.stringify(afterDenied.spec) === JSON.stringify(beforeDenied.spec) &&
			afterDenied.metadata.resourceVersion === beforeDenied.metadata.resourceVersion,
		'Read-only denied mutation changed Kubernetes spec or resourceVersion'
	);
	await api('/api/v1/user/cluster', { method: 'PUT', body: { clusterId: 'in-cluster' } });
	assert(browserErrors.length === 0, `In-cluster browser errors: ${browserErrors.join('; ')}`);
	await context.close();
	await browser.close();
	browser = undefined;
	console.log(
		'SSA preview defaulting, immutable preview state, failed-preview viewer/export, and read-only RBAC passed.'
	);
}

function cleanup() {
	if (cleanupPromise) return cleanupPromise;
	cleanupPromise = (async () => {
		if (browser) await browser.close().catch(() => {});
		const activeChildren = [...owned.children];
		const closedChildren = new Set();
		const closeWaits = activeChildren.map(
			(child) =>
				new Promise((resolve) => {
					child.once('close', () => {
						closedChildren.add(child);
						resolve();
					});
				})
		);
		for (const child of activeChildren) child.kill('SIGTERM');
		if (activeChildren.length) {
			await Promise.race([Promise.all(closeWaits), delay(5000)]);
			const stuckChildren = activeChildren.filter((child) => !closedChildren.has(child));
			for (const child of stuckChildren) child.kill('SIGKILL');
			if (stuckChildren.length) {
				await Promise.race([Promise.all(closeWaits), delay(5000)]);
				if (stuckChildren.some((child) => !closedChildren.has(child)))
					cleanupErrors.push('A child process did not stop after SIGKILL');
			}
		}
		if (owned.container) {
			try {
				run('docker', ['rm', '-f', owned.container], { stdio: 'ignore' });
				try {
					run('docker', ['inspect', owned.container]);
					cleanupErrors.push(`Docker container ${owned.container} remains after cleanup`);
				} catch {
					// Expected: the owned container no longer exists.
				}
			} catch {
				cleanupErrors.push(`Could not remove Docker container ${owned.container}`);
			}
		}
		if (owned.cluster) {
			try {
				await runAsync('kind', ['delete', 'cluster', '--name', owned.cluster], {
					timeout: 120_000,
					cleanup: true
				});
			} catch {
				cleanupErrors.push(`Could not delete Kind cluster ${owned.cluster}`);
			}
		}
		if (tempDir) {
			try {
				rmSync(tempDir, { recursive: true, force: true });
			} catch {
				cleanupErrors.push('Could not remove temporary credentials directory');
			}
		}
	})();
	return cleanupPromise;
}

for (const signal of ['SIGINT', 'SIGTERM']) {
	process.once(signal, () => {
		interrupted = true;
		const expectedExitCode = signal === 'SIGINT' ? 130 : 143;
		requestedExitCode = expectedExitCode;
		process.exitCode = expectedExitCode;
		void cleanup().finally(() => {
			if (cleanupErrors.length) console.error(`Cleanup failed: ${cleanupErrors.join('; ')}`);
			process.exit(expectedExitCode);
		});
	});
}

try {
	const { image, platform } = parseArgs(process.argv.slice(2));
	await checkLocalImage(image, platform);
	await runtimeAndBrowser(image, platform);
	await clusterAndFlux(image, platform);
	console.log(`Image smoke passed for ${image} (${platform}).`);
} catch (error) {
	console.error(error instanceof Error ? redact(error.message) : 'Image smoke failed.');
	process.exitCode = requestedExitCode ?? 1;
} finally {
	await cleanup();
	if (cleanupErrors.length) {
		console.error(`Cleanup failed: ${cleanupErrors.join('; ')}`);
		process.exitCode = requestedExitCode ?? 1;
	}
}
