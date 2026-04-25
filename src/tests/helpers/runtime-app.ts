import { mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { createServer } from 'node:net';
import { join } from 'node:path';

const HEALTH_PATH = '/api/v1/health';
const ADMIN_PASSWORD = 'runtime-admin-password';
const METRICS_TOKEN = 'runtime-metrics-token';
const PROD_SECRET = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
const REPO_ROOT = process.cwd();
const DATA_ROOT = join(REPO_ROOT, 'data');
const BACKUP_ROOT = join(DATA_ROOT, 'backups');

interface RuntimeAppHandle {
	backupDir: string;
	baseUrl: string;
	cleanup: () => Promise<void>;
	fetch: (path: string, init?: RequestInit) => Promise<Response>;
}

let buildPromise: Promise<void> | null = null;
let runtimeAppPromise: Promise<RuntimeAppHandle> | null = null;

async function runBuildOnce(): Promise<void> {
	if (!buildPromise) {
		buildPromise = (async () => {
			const buildEnv = {
				...process.env,
				NODE_ENV: 'production'
			};
			const build = Bun.spawn(['bun', 'run', 'build'], {
				cwd: REPO_ROOT,
				env: buildEnv,
				stderr: 'pipe',
				stdout: 'pipe'
			});
			const stdoutPromise = new Response(build.stdout).text();
			const stderrPromise = new Response(build.stderr).text();
			const exitCode = await build.exited;

			if (exitCode !== 0) {
				const [stdout, stderr] = await Promise.all([stdoutPromise, stderrPromise]);
				throw new Error(
					`bun run build failed with exit code ${exitCode}\n${stdout}${stderr}`.trim()
				);
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

async function waitForReadiness(
	baseUrl: string,
	server: ReturnType<typeof Bun.spawn>,
	captureStderr: () => Promise<string>,
	timeoutMs = 30_000
): Promise<void> {
	const deadline = Date.now() + timeoutMs;
	const exitedResultPromise = server.exited.then((code) => ({ code, exited: true as const }));

	while (Date.now() < deadline) {
		const exitCode = await Promise.race([
			exitedResultPromise,
			Bun.sleep(250).then(() => ({ code: 0, exited: false as const }))
		]);

		if (exitCode.exited) {
			const stderr = await captureStderr();
			throw new Error(
				`Built runtime exited before becoming ready (exit ${exitCode.code})\n${stderr}`.trim()
			);
		}

		try {
			const response = await fetch(new URL(HEALTH_PATH, baseUrl));
			if (response.status === 200) {
				return;
			}
		} catch {
			// Poll until ready or timeout.
		}
	}

	server.kill('SIGTERM');
	await server.exited;
	const stderr = await captureStderr();
	throw new Error(`Timed out waiting for ${HEALTH_PATH}\n${stderr}`.trim());
}

export async function getRuntimeApp(): Promise<RuntimeAppHandle> {
	if (!runtimeAppPromise) {
		runtimeAppPromise = (async () => {
			await runBuildOnce();
			mkdirSync(DATA_ROOT, { recursive: true });
			mkdirSync(BACKUP_ROOT, { recursive: true });

			const port = await allocatePort();
			const tempDataDir = mkdtempSync(join(DATA_ROOT, 'runtime-app-'));
			const backupDir = mkdtempSync(join(BACKUP_ROOT, 'runtime-app-'));
			const databasePath = join(tempDataDir, 'gyre.db');

			const server = Bun.spawn(['node', 'build/index.js'], {
				cwd: REPO_ROOT,
				env: {
					...process.env,
					ADMIN_PASSWORD,
					AUTH_ENCRYPTION_KEY: PROD_SECRET,
					BACKUP_DIR: backupDir,
					BACKUP_ENCRYPTION_KEY: PROD_SECRET,
					DATABASE_URL: databasePath,
					GYRE_ENCRYPTION_KEY: PROD_SECRET,
					GYRE_METRICS_TOKEN: METRICS_TOKEN,
					NODE_ENV: 'production',
					PORT: String(port)
				},
				stderr: 'pipe',
				stdout: 'ignore'
			});
			let stderrPromise: Promise<string> | null = null;
			const captureStderr = () => {
				if (!stderrPromise) {
					stderrPromise = server.stderr ? new Response(server.stderr).text() : Promise.resolve('');
				}
				return stderrPromise;
			};
			const baseUrl = `http://127.0.0.1:${port}`;
			const serverExited = server.exited.then(
				() => undefined,
				() => undefined
			);
			const waitForServerExit = async (timeoutMs: number): Promise<boolean> => {
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
			};

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
					server.kill('SIGTERM');
					if (!(await waitForServerExit(5_000))) {
						server.kill('SIGKILL');
						await serverExited;
					}
					rmSync(tempDataDir, { force: true, recursive: true });
					rmSync(backupDir, { force: true, recursive: true });
					runtimeAppPromise = null;
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
