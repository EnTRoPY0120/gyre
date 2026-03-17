import { describe, test, expect, afterEach, beforeEach, mock } from 'bun:test';

import { Database } from 'bun:sqlite';
import { drizzle } from 'drizzle-orm/bun-sqlite';
import * as schema from '../lib/server/db/schema.js';
import { clusters } from '../lib/server/db/schema.js';

const state: { db: ReturnType<typeof drizzle<typeof schema>> | null } = { db: null };

mock.module('../lib/server/db/index.js', () => ({
	getDb: async () => state.db,
	getDbSync: () => state.db,
	schema
}));

import {
	testEncryption,
	isUsingDevelopmentKey,
	migrateKubeconfigs,
	_decryptKubeconfig,
	_resetEncryptionKeyCache,
	_encryptLegacyXorKubeconfig
} from '../lib/server/clusters';

// ---------------------------------------------------------------------------
// In-memory DB helpers
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Cluster Kubeconfig Encryption
// ---------------------------------------------------------------------------

describe('Cluster Kubeconfig Encryption', () => {
	const originalKey = process.env.GYRE_ENCRYPTION_KEY;
	afterEach(() => {
		if (originalKey !== undefined) {
			process.env.GYRE_ENCRYPTION_KEY = originalKey;
		} else {
			delete process.env.GYRE_ENCRYPTION_KEY;
		}
		_resetEncryptionKeyCache();
	});

	describe('testEncryption()', () => {
		test('returns true when encryption subsystem is working', () => {
			expect(testEncryption()).toBe(true);
		});
	});

	describe('isUsingDevelopmentKey()', () => {
		test('returns true when GYRE_ENCRYPTION_KEY is not set', () => {
			delete process.env.GYRE_ENCRYPTION_KEY;
			expect(isUsingDevelopmentKey()).toBe(true);
		});
		test('returns false when GYRE_ENCRYPTION_KEY is set', () => {
			process.env.GYRE_ENCRYPTION_KEY = 'a'.repeat(64);
			expect(isUsingDevelopmentKey()).toBe(false);
		});
	});

	describe('_decryptKubeconfig — v2 format', () => {
		test('throws on invalid v2 string (wrong number of colons)', () => {
			expect(() => _decryptKubeconfig('v2:abc:def')).toThrow(
				'Invalid v2 encrypted kubeconfig format'
			);
		});
	});

	describe('_decryptKubeconfig — XOR format rejection', () => {
		test('throws when given a non-v2 prefixed string', () => {
			const legacyXor = Buffer.from('fake-xor-data').toString('base64');
			expect(() => _decryptKubeconfig(legacyXor)).toThrow(
				'Unsupported kubeconfig encryption format'
			);
		});
		test('error message mentions v2', () => {
			expect(() => _decryptKubeconfig('not-v2')).toThrow('v2');
		});
	});
});

// ---------------------------------------------------------------------------
// migrateKubeconfigs
// ---------------------------------------------------------------------------

describe('migrateKubeconfigs()', () => {
	const TEST_KEY = 'ab'.repeat(32); // 64 hex chars

	beforeEach(() => {
		process.env.GYRE_ENCRYPTION_KEY = TEST_KEY;
		_resetEncryptionKeyCache();
		state.db = setupInMemoryDb();
	});

	afterEach(() => {
		delete process.env.GYRE_ENCRYPTION_KEY;
		_resetEncryptionKeyCache();
		state.db = null;
	});

	test('migrates a legacy XOR record and returns migrated: 1, failed: 0', async () => {
		const xorEncrypted = _encryptLegacyXorKubeconfig('apiVersion: v1\nkind: Config');
		insertCluster(state.db!, 'legacy-1', xorEncrypted);

		const result = await migrateKubeconfigs();

		expect(result.migrated).toBe(1);
		expect(result.failed).toBe(0);
	});

	test('converted record now has v2 prefix', async () => {
		const xorEncrypted = _encryptLegacyXorKubeconfig('apiVersion: v1\nkind: Config');
		insertCluster(state.db!, 'legacy-2', xorEncrypted);

		await migrateKubeconfigs();

		const updated = await state.db!.query.clusters.findFirst({
			where: (c, { eq }) => eq(c.id, 'legacy-2')
		});
		expect(updated?.kubeconfigEncrypted).toMatch(/^v2:/);
	});

	test('skips clusters that already have v2-format kubeconfigs', async () => {
		insertCluster(state.db!, 'v2-1', 'v2:aabbcc:deadbeef:112233');

		const result = await migrateKubeconfigs();

		expect(result.migrated).toBe(0);
		expect(result.failed).toBe(0);
	});

	test('skips clusters with null kubeconfig', async () => {
		insertCluster(state.db!, 'null-1', null);

		const result = await migrateKubeconfigs();

		expect(result.migrated).toBe(0);
		expect(result.failed).toBe(0);
	});

	test('handles a mix of legacy and v2 records correctly', async () => {
		insertCluster(state.db!, 'mix-legacy', _encryptLegacyXorKubeconfig('apiVersion: v1'));
		insertCluster(state.db!, 'mix-v2', 'v2:aabbcc:deadbeef:112233');
		insertCluster(state.db!, 'mix-null', null);

		const result = await migrateKubeconfigs();

		expect(result.migrated).toBe(1);
		expect(result.failed).toBe(0);
	});
});
