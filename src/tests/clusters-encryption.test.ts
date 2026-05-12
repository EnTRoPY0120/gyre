import { afterEach, beforeEach, describe, expect, vi, test } from 'vitest';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import * as schema from '../lib/server/db/schema.js';
import { clusters } from '../lib/server/db/schema.js';
import { importFresh } from './helpers/import-fresh';
import { encryptLegacyXorKubeconfig } from './helpers/xor-kubeconfig.js';

type ClustersModule = typeof import('../lib/server/clusters');

const state: { db: ReturnType<typeof drizzle<typeof schema>> | null } = { db: null };

let clustersModule: ClustersModule;

const CREATE_CLUSTERS_TABLE = `
	CREATE TABLE IF NOT EXISTS clusters (
		id TEXT PRIMARY KEY,
		name TEXT NOT NULL UNIQUE,
		description TEXT,
		kubeconfig_encrypted TEXT,
		is_active INTEGER NOT NULL DEFAULT 1,
		is_local INTEGER NOT NULL DEFAULT 0,
		context_count INTEGER NOT NULL DEFAULT 1,
		last_connected_at INTEGER,
		last_error TEXT,
		created_at INTEGER NOT NULL DEFAULT (unixepoch()),
		updated_at INTEGER NOT NULL DEFAULT (unixepoch())
	)
`;

const VALID_KUBECONFIG_YAML = 'apiVersion: v1\nclusters: []\ncontexts: []\nusers: []';

function setupInMemoryDb() {
	const sqlite = new Database(':memory:');
	sqlite.exec(CREATE_CLUSTERS_TABLE);
	return drizzle(sqlite, { schema });
}

type TestDb = ReturnType<typeof setupInMemoryDb>;

function insertCluster(db: TestDb, id: string, kubeconfigEncrypted: string | null) {
	db.insert(clusters)
		.values({
			id,
			name: `test-cluster-${id}`,
			kubeconfigEncrypted,
			isActive: true,
			isLocal: true,
			contextCount: 1
		})
		.run();
}

const originalKey = process.env.GYRE_ENCRYPTION_KEY;

beforeEach(async () => {
	vi.doMock('../lib/server/db/index.js', () => ({
		getDb: async () => state.db,
		getDbSync: () => state.db,
		schema
	}));

	clustersModule = await importFresh<ClustersModule>('../lib/server/clusters');
});

afterEach(() => {
	if (originalKey !== undefined) {
		process.env.GYRE_ENCRYPTION_KEY = originalKey;
	} else {
		delete process.env.GYRE_ENCRYPTION_KEY;
	}
	clustersModule._resetEncryptionKeyCache();
	state.db = null;
	vi.restoreAllMocks();
	vi.resetModules();
});

describe('Cluster Kubeconfig Encryption', () => {
	describe('testEncryption()', () => {
		test('returns true when encryption subsystem is working', () => {
			expect(clustersModule.testEncryption()).toBe(true);
		});
	});

	describe('isUsingDevelopmentKey()', () => {
		test('returns true when GYRE_ENCRYPTION_KEY is not set', () => {
			delete process.env.GYRE_ENCRYPTION_KEY;
			expect(clustersModule.isUsingDevelopmentKey()).toBe(true);
		});

		test('returns false when GYRE_ENCRYPTION_KEY is set', () => {
			process.env.GYRE_ENCRYPTION_KEY = 'a'.repeat(64);
			expect(clustersModule.isUsingDevelopmentKey()).toBe(false);
		});
	});

	describe('_decryptKubeconfig — v2 format', () => {
		test('throws on invalid v2 string (wrong number of colons)', () => {
			expect(() => clustersModule._decryptKubeconfig('v2:abc:def')).toThrow(
				'Invalid v2 encrypted kubeconfig format'
			);
		});
	});

	describe('_decryptKubeconfig — XOR format rejection', () => {
		test('throws when given a non-v2 prefixed string', () => {
			const legacyXor = Buffer.from('fake-xor-data').toString('base64');
			expect(() => clustersModule._decryptKubeconfig(legacyXor)).toThrow(
				'Unsupported kubeconfig encryption format'
			);
		});

		test('error message mentions v2', () => {
			expect(() => clustersModule._decryptKubeconfig('not-v2')).toThrow('v2');
		});
	});
});

describe('migrateKubeconfigs()', () => {
	const TEST_KEY = 'ab'.repeat(32);

	beforeEach(() => {
		process.env.GYRE_ENCRYPTION_KEY = TEST_KEY;
		clustersModule._resetEncryptionKeyCache();
		state.db = setupInMemoryDb();
	});

	test('migrates a legacy XOR record and returns migrated: 1, failed: 0', async () => {
		insertCluster(state.db!, 'legacy-1', encryptLegacyXorKubeconfig(VALID_KUBECONFIG_YAML));

		const result = await clustersModule.migrateKubeconfigs();

		expect(result.migrated).toBe(1);
		expect(result.failed).toBe(0);
	});

	test('converted record now has v2 prefix', async () => {
		insertCluster(state.db!, 'legacy-2', encryptLegacyXorKubeconfig(VALID_KUBECONFIG_YAML));

		await clustersModule.migrateKubeconfigs();

		const updated = await state.db!.query.clusters.findFirst({
			where: (c, { eq }) => eq(c.id, 'legacy-2')
		});
		expect(updated?.kubeconfigEncrypted).toMatch(/^v2:/);
	});

	test('skips clusters that already have v2-format kubeconfigs', async () => {
		insertCluster(state.db!, 'v2-1', 'v2:aabbcc:deadbeef:112233');

		const result = await clustersModule.migrateKubeconfigs();

		expect(result.migrated).toBe(0);
		expect(result.failed).toBe(0);
	});

	test('skips clusters with null kubeconfig', async () => {
		insertCluster(state.db!, 'null-1', null);

		const result = await clustersModule.migrateKubeconfigs();

		expect(result.migrated).toBe(0);
		expect(result.failed).toBe(0);
	});

	test('handles a mix of legacy and v2 records correctly', async () => {
		insertCluster(state.db!, 'mix-legacy', encryptLegacyXorKubeconfig(VALID_KUBECONFIG_YAML));
		insertCluster(state.db!, 'mix-v2', 'v2:aabbcc:deadbeef:112233');
		insertCluster(state.db!, 'mix-null', null);

		const result = await clustersModule.migrateKubeconfigs();

		expect(result.migrated).toBe(1);
		expect(result.failed).toBe(0);
	});

	test('increments failed and preserves original ciphertext when decryption yields invalid kubeconfig', async () => {
		const keyA = 'aa'.repeat(32);
		process.env.GYRE_ENCRYPTION_KEY = keyA;
		const originalCiphertext = encryptLegacyXorKubeconfig(VALID_KUBECONFIG_YAML);
		insertCluster(state.db!, 'wrong-key', originalCiphertext);

		process.env.GYRE_ENCRYPTION_KEY = 'bb'.repeat(32);
		clustersModule._resetEncryptionKeyCache();

		const result = await clustersModule.migrateKubeconfigs();

		expect(result.failed).toBe(1);
		expect(result.migrated).toBe(0);

		const cluster = await state.db!.query.clusters.findFirst({
			where: (c, { eq }) => eq(c.id, 'wrong-key')
		});
		expect(cluster?.kubeconfigEncrypted).toBe(originalCiphertext);
	});
});
