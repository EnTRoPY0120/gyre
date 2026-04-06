/**
 * Security-focused tests for file upload validation.
 *
 * Covers sanitizeFilename, isAllowedBackupExtension, and the kubeconfig
 * kind/apiVersion check added in GH #286.
 */
import { afterAll, beforeEach, describe, expect, mock, test } from 'bun:test';
const { sanitizeFilename, isAllowedBackupExtension, isAllowedBackupMimeType } =
	(await import('../lib/server/validation.js?test=file-upload-security')) as typeof import('../lib/server/validation.js');

const clusterActionState = {
	createClusterCalls: [] as Array<Record<string, unknown>>,
	logClusterChangeCalls: [] as Array<unknown[]>
};

function registerRouteMocks() {
	mock.module('$lib/server/clusters', () => ({
		getAllClustersPaginated: async () => ({ clusters: [], total: 0 }),
		createCluster: async (input: Record<string, unknown>) => {
			clusterActionState.createClusterCalls.push(input);
			return {
				id: 'cluster-1',
				name: input.name,
				description: input.description ?? null,
				contextCount: 1
			};
		},
		updateCluster: async () => null,
		deleteCluster: async () => {},
		testClusterConnection: async () => ({
			connected: true,
			clusterName: 'cluster-1',
			timestamp: new Date().toISOString(),
			checks: []
		}),
		getClusterById: async () => null
	}));

	mock.module('$lib/server/rbac', () => ({
		isAdmin: () => true
	}));

	mock.module('$lib/server/rbac.js', () => ({
		isAdmin: () => true
	}));

	mock.module('$lib/server/audit', () => ({
		logClusterChange: async (...args: unknown[]) => {
			clusterActionState.logClusterChangeCalls.push(args);
		}
	}));

	mock.module('$lib/server/logger.js', () => ({
		logger: {
			error: () => {},
			info: () => {},
			warn: () => {}
		}
	}));
}

let actionsImportCounter = 0;

async function loadActions() {
	registerRouteMocks();
	const { actions } = (await import(
		`../routes/admin/clusters/+page.server.js?test=file-upload-security-${++actionsImportCounter}`
	)) as typeof import('../routes/admin/clusters/+page.server.js');
	mock.restore();
	return actions;
}

afterAll(() => {
	mock.restore();
});

// ---------------------------------------------------------------------------
// sanitizeFilename
// ---------------------------------------------------------------------------

describe('sanitizeFilename', () => {
	test('strips newline characters', () => {
		expect(sanitizeFilename('backup\n.db')).toBe('backup.db');
	});

	test('strips carriage return characters', () => {
		expect(sanitizeFilename('backup\r.db')).toBe('backup.db');
	});

	test('strips null bytes', () => {
		expect(sanitizeFilename('backup\x00.db')).toBe('backup.db');
	});

	test('strips all control characters (\\x00-\\x1f)', () => {
		const allControls = Array.from({ length: 32 }, (_, i) => String.fromCharCode(i)).join('');
		expect(sanitizeFilename(allControls + 'safe')).toBe('safe');
	});

	test('strips DEL character (\\x7f)', () => {
		expect(sanitizeFilename('file\x7fname.db')).toBe('filename.db');
	});

	test('passes safe filenames unchanged', () => {
		expect(sanitizeFilename('gyre-backup-2026-03-18.db')).toBe('gyre-backup-2026-03-18.db');
	});

	test('passes filenames with dots, dashes, underscores unchanged', () => {
		expect(sanitizeFilename('my_backup.db.enc')).toBe('my_backup.db.enc');
	});

	test('truncates to 255 characters', () => {
		const long = 'a'.repeat(300);
		expect(sanitizeFilename(long).length).toBe(255);
	});

	test('does not truncate names at or below 255 chars', () => {
		const exact = 'a'.repeat(255);
		expect(sanitizeFilename(exact)).toBe(exact);
	});
});

// ---------------------------------------------------------------------------
// isAllowedBackupExtension
// ---------------------------------------------------------------------------

describe('isAllowedBackupExtension', () => {
	test('accepts .db extension', () => {
		expect(isAllowedBackupExtension('gyre-backup.db')).toBe(true);
	});

	test('accepts .db.enc extension', () => {
		expect(isAllowedBackupExtension('gyre-backup.db.enc')).toBe(true);
	});

	test('rejects .exe', () => {
		expect(isAllowedBackupExtension('malicious.exe')).toBe(false);
	});

	test('rejects .sh', () => {
		expect(isAllowedBackupExtension('script.sh')).toBe(false);
	});

	test('rejects .db.bak (double extension trick)', () => {
		expect(isAllowedBackupExtension('backup.db.bak')).toBe(false);
	});

	test('rejects .sqlite', () => {
		expect(isAllowedBackupExtension('backup.sqlite')).toBe(false);
	});

	test('rejects no extension', () => {
		expect(isAllowedBackupExtension('backup')).toBe(false);
	});

	test('rejects .DB (case sensitive)', () => {
		expect(isAllowedBackupExtension('backup.DB')).toBe(false);
	});
});

// ---------------------------------------------------------------------------
// isAllowedBackupMimeType
// ---------------------------------------------------------------------------

describe('isAllowedBackupMimeType', () => {
	test('accepts application/octet-stream', () => {
		expect(isAllowedBackupMimeType('application/octet-stream')).toBe(true);
	});

	test('accepts application/x-sqlite3', () => {
		expect(isAllowedBackupMimeType('application/x-sqlite3')).toBe(true);
	});

	test('accepts empty string (browser-omitted MIME type)', () => {
		expect(isAllowedBackupMimeType('')).toBe(true);
	});

	test('strips semicolon parameters before matching', () => {
		expect(isAllowedBackupMimeType('application/octet-stream; charset=utf-8')).toBe(true);
	});

	test('strips semicolon parameters with whitespace before semicolon', () => {
		expect(isAllowedBackupMimeType('application/octet-stream ; charset=utf-8')).toBe(true);
	});

	test('rejects application/zip', () => {
		expect(isAllowedBackupMimeType('application/zip')).toBe(false);
	});

	test('rejects application/x-executable', () => {
		expect(isAllowedBackupMimeType('application/x-executable')).toBe(false);
	});

	test('rejects application/javascript', () => {
		expect(isAllowedBackupMimeType('application/javascript')).toBe(false);
	});

	test('rejects text/plain', () => {
		expect(isAllowedBackupMimeType('text/plain')).toBe(false);
	});

	test('rejects image/png', () => {
		expect(isAllowedBackupMimeType('image/png')).toBe(false);
	});

	test('rejects whitespace-only MIME string', () => {
		expect(isAllowedBackupMimeType('   ')).toBe(false);
	});

	test('accepts mixed-case MIME type (case-insensitive per RFC 2045)', () => {
		expect(isAllowedBackupMimeType('Application/Octet-Stream')).toBe(true);
	});
});

// ---------------------------------------------------------------------------
// Kubeconfig validation via route action
// ---------------------------------------------------------------------------

describe('cluster create action kubeconfig validation', () => {
	function buildEvent(kubeconfig: string) {
		const formData = new FormData();
		formData.set('name', 'demo-cluster');
		formData.set('description', 'test');
		formData.set('kubeconfig', kubeconfig);

		return {
			request: new Request('http://localhost/admin/clusters', {
				method: 'POST',
				body: formData
			}),
			locals: {
				user: {
					id: 'admin-1',
					username: 'admin',
					role: 'admin'
				}
			}
		} as Parameters<NonNullable<typeof actions.create>>[0];
	}

	async function submitCreate(kubeconfig: string) {
		const actions = await loadActions();
		return actions.create!(buildEvent(kubeconfig));
	}

	beforeEach(() => {
		clusterActionState.createClusterCalls.length = 0;
		clusterActionState.logClusterChangeCalls.length = 0;
	});

	test('accepts a valid kubeconfig via the route action', async () => {
		const result = await submitCreate(`
apiVersion: v1
kind: Config
clusters:
  - name: demo
    cluster: {}
contexts:
  - name: demo
    context: {}
`);

		expect(result).toMatchObject({ success: true });
		expect(clusterActionState.createClusterCalls).toHaveLength(1);
		expect(clusterActionState.logClusterChangeCalls).toHaveLength(1);
	});

	test('rejects missing kind', async () => {
		const result = await submitCreate(`
apiVersion: v1
clusters: []
contexts: []
`);

		expect(result).toMatchObject({
			status: 400,
			data: { error: 'Invalid kubeconfig: must have kind: Config and apiVersion: v1' }
		});
		expect(clusterActionState.createClusterCalls).toHaveLength(0);
		expect(clusterActionState.logClusterChangeCalls).toHaveLength(0);
	});

	test('rejects missing apiVersion', async () => {
		const result = await submitCreate(`
kind: Config
clusters: []
contexts: []
`);

		expect(result).toMatchObject({
			status: 400,
			data: { error: 'Invalid kubeconfig: must have kind: Config and apiVersion: v1' }
		});
		expect(clusterActionState.createClusterCalls).toHaveLength(0);
		expect(clusterActionState.logClusterChangeCalls).toHaveLength(0);
	});

	test('rejects wrong kind', async () => {
		const result = await submitCreate(`
apiVersion: v1
kind: Secret
clusters: []
contexts: []
`);

		expect(result).toMatchObject({
			status: 400,
			data: { error: 'Invalid kubeconfig: must have kind: Config and apiVersion: v1' }
		});
		expect(clusterActionState.createClusterCalls).toHaveLength(0);
		expect(clusterActionState.logClusterChangeCalls).toHaveLength(0);
	});

	test('rejects wrong apiVersion', async () => {
		const result = await submitCreate(`
apiVersion: apps/v1
kind: Config
clusters: []
contexts: []
`);

		expect(result).toMatchObject({
			status: 400,
			data: { error: 'Invalid kubeconfig: must have kind: Config and apiVersion: v1' }
		});
		expect(clusterActionState.createClusterCalls).toHaveLength(0);
		expect(clusterActionState.logClusterChangeCalls).toHaveLength(0);
	});

	test('rejects clusters as a non-array value', async () => {
		const result = await submitCreate(`
apiVersion: v1
kind: Config
clusters: nope
contexts: []
`);

		expect(result).toMatchObject({
			status: 400,
			data: { error: 'Invalid kubeconfig: clusters and contexts must be arrays' }
		});
		expect(clusterActionState.createClusterCalls).toHaveLength(0);
		expect(clusterActionState.logClusterChangeCalls).toHaveLength(0);
	});

	test('rejects contexts as a non-array value', async () => {
		const result = await submitCreate(`
apiVersion: v1
kind: Config
clusters: []
contexts: nope
`);

		expect(result).toMatchObject({
			status: 400,
			data: { error: 'Invalid kubeconfig: clusters and contexts must be arrays' }
		});
		expect(clusterActionState.createClusterCalls).toHaveLength(0);
		expect(clusterActionState.logClusterChangeCalls).toHaveLength(0);
	});

	test('rejects parse failures', async () => {
		const result = await submitCreate('apiVersion: v1\nkind: Config\nclusters: [\ncontexts: []');

		expect(result).toMatchObject({
			status: 400,
			data: { error: 'Invalid kubeconfig format: could not parse as YAML or JSON' }
		});
		expect(clusterActionState.createClusterCalls).toHaveLength(0);
		expect(clusterActionState.logClusterChangeCalls).toHaveLength(0);
	});
});

afterAll(() => {
	mock.restore();
});
