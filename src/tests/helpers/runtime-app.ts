import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const HEALTH_PATH = '/api/v1/health';
const ADMIN_PASSWORD = 'RuntimeAdminPassword!1';
const METRICS_TOKEN = 'runtime-metrics-token';
const PROD_SECRET = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
const BETTER_AUTH_SECRET = 'runtime-better-auth-secret-with-enough-entropy';
const REPO_ROOT = process.cwd();
const RUNTIME_TEMP_PREFIX = join(tmpdir(), 'runtime-app-');
const READINESS_PROBE_TIMEOUT_MS = 1_500;
const TERMINATION_GRACE_MS = 5_000;
const KILL_EXIT_GRACE_MS = 1_000;

interface RuntimeAppHandle {
	backupDir: string;
	baseUrl: string;
	cleanup: () => Promise<void>;
	fetch: (path: string, init?: RequestInit) => Promise<Response>;
}

let buildPromise: Promise<void> | null = null;
let runtimeAppPromise: Promise<RuntimeAppHandle> | null = null;

function sleep(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

function collectStream(stream: NodeJS.ReadableStream): Promise<string> {
	let output = '';
	stream.setEncoding('utf8');
	stream.on('data', (chunk) => {
		output += chunk;
	});
	return new Promise((resolve, reject) => {
		stream.once('error', reject);
		stream.once('end', () => resolve(output));
	});
}

function waitForExit(child: ChildProcessWithoutNullStreams): Promise<number | null> {
	return new Promise((resolve, reject) => {
		child.once('error', reject);
		child.once('exit', (code) => resolve(code));
	});
}

async function runBuildOnce(): Promise<void> {
	if (!buildPromise) {
		buildPromise = (async () => {
			const buildEnv = {
				...process.env,
				NODE_ENV: 'production'
			};
			const build = spawn('pnpm', ['build'], {
				cwd: REPO_ROOT,
				env: buildEnv,
				stdio: ['ignore', 'pipe', 'pipe']
			});
			const stdoutPromise = collectStream(build.stdout);
			const stderrPromise = collectStream(build.stderr);
			stdoutPromise.catch(() => {});
			stderrPromise.catch(() => {});
			const exitCode = await waitForExit(build);

			if (exitCode !== 0) {
				const [stdout, stderr] = await Promise.all([stdoutPromise, stderrPromise]);
				throw new Error(`pnpm build failed with exit code ${exitCode}\n${stdout}${stderr}`.trim());
			}
		})().catch((error) => {
			buildPromise = null;
			throw error;
		});
	}

	await buildPromise;
}

async function allocatePort(): Promise<number> {
	const server = createServer();

	return await new Promise((resolve, reject) => {
		server.once('error', reject);
		server.listen(0, '127.0.0.1', () => {
			const address = server.address();
			if (!address || typeof address === 'string') {
				server.close(() => reject(new Error('Failed to allocate a localhost port')));
				return;
			}

			server.close((closeError) => {
				if (closeError) {
					reject(closeError);
					return;
				}

				resolve(address.port);
			});
		});
	});
}

async function waitForServerExit(serverExited: Promise<void>, timeoutMs: number): Promise<boolean> {
	let timeout: ReturnType<typeof setTimeout> | undefined;
	const timeoutPromise = new Promise<'timeout'>((resolve) => {
		timeout = setTimeout(resolve, timeoutMs, 'timeout');
	});

	try {
		return (
			(await Promise.race([serverExited.then(() => 'exited' as const), timeoutPromise])) ===
			'exited'
		);
	} finally {
		if (timeout) {
			clearTimeout(timeout);
		}
	}
}

async function terminateServer(
	server: ChildProcessWithoutNullStreams,
	serverExited: Promise<void>
) {
	server.kill('SIGTERM');
	if (!(await waitForServerExit(serverExited, TERMINATION_GRACE_MS))) {
		server.kill('SIGKILL');
		await waitForServerExit(serverExited, KILL_EXIT_GRACE_MS);
	}
}

async function waitForReadiness(
	baseUrl: string,
	server: ChildProcessWithoutNullStreams,
	captureStderr: () => Promise<string>,
	timeoutMs = 30_000
): Promise<void> {
	const deadline = Date.now() + timeoutMs;
	const exitPromise = waitForExit(server);
	const exitedResultPromise = exitPromise.then((code) => ({ code, exited: true as const }));
	const serverExited = exitPromise.then(
		() => undefined,
		() => undefined
	);

	while (Date.now() < deadline) {
		const exitResult = await Promise.race([
			exitedResultPromise,
			sleep(250).then(() => ({ code: 0, exited: false as const }))
		]);

		if (exitResult.exited) {
			const stderr = await captureStderr();
			throw new Error(
				`Built runtime exited before becoming ready (exit ${exitResult.code})\n${stderr}`.trim()
			);
		}

		const controller = new AbortController();
		const probeTimeout = setTimeout(() => controller.abort(), READINESS_PROBE_TIMEOUT_MS);
		try {
			const response = await fetch(new URL(HEALTH_PATH, baseUrl), {
				signal: controller.signal
			});
			if (response.status === 200) {
				return;
			}
		} catch {
			// Poll until ready or timeout.
		} finally {
			clearTimeout(probeTimeout);
		}
	}

	await terminateServer(server, serverExited);
	const stderr = await captureStderr();
	throw new Error(`Timed out waiting for ${HEALTH_PATH}\n${stderr}`.trim());
}

export async function getRuntimeApp(): Promise<RuntimeAppHandle> {
	if (!runtimeAppPromise) {
		runtimeAppPromise = (async () => {
			await runBuildOnce();

			const port = await allocatePort();
			const tempDataDir = mkdtempSync(RUNTIME_TEMP_PREFIX);
			const backupDir = mkdtempSync(RUNTIME_TEMP_PREFIX);
			const databasePath = join(tempDataDir, 'gyre.db');

			const server = spawn('node', ['build/index.js'], {
				cwd: REPO_ROOT,
				env: {
					...process.env,
					ADMIN_PASSWORD,
					AUTH_ENCRYPTION_KEY: PROD_SECRET,
					BACKUP_DIR: backupDir,
					BACKUP_ENCRYPTION_KEY: PROD_SECRET,
					BETTER_AUTH_SECRET,
					DATABASE_URL: databasePath,
					GYRE_ENCRYPTION_KEY: PROD_SECRET,
					GYRE_METRICS_TOKEN: METRICS_TOKEN,
					GYRE_RUNTIME_BACKUP_ROOT: backupDir,
					GYRE_RUNTIME_DATABASE_ROOT: tempDataDir,
					GYRE_RUNTIME_TEST_MODE: '1',
					NODE_ENV: 'production',
					PORT: String(port)
				},
				stdio: ['ignore', 'ignore', 'pipe']
			});
			const stderrPromise = collectStream(server.stderr);
			const captureStderr = () => stderrPromise;
			const baseUrl = `http://127.0.0.1:${port}`;
			const serverExited = waitForExit(server).then(
				() => undefined,
				() => undefined
			);

			try {
				await waitForReadiness(baseUrl, server, captureStderr);
			} catch (error) {
				rmSync(tempDataDir, { force: true, recursive: true });
				rmSync(backupDir, { force: true, recursive: true });
				throw error;
			}

			let cleanedUp = false;
			return {
				backupDir,
				baseUrl,
				fetch: (path: string, init?: RequestInit) => fetch(new URL(path, baseUrl), init),
				cleanup: async () => {
					if (cleanedUp) {
						return;
					}

					cleanedUp = true;
					runtimeAppPromise = null;
					await terminateServer(server, serverExited);
					await stderrPromise;
					rmSync(tempDataDir, { force: true, recursive: true });
					rmSync(backupDir, { force: true, recursive: true });
				}
			};
		})().catch((error) => {
			runtimeAppPromise = null;
			throw error;
		});
	}

	return await runtimeAppPromise;
}

export function getRuntimeMetricsToken(): string {
	return METRICS_TOKEN;
}

export function getRuntimeAdminPassword(): string {
	return ADMIN_PASSWORD;
}
