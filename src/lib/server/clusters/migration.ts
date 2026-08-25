import { logger } from '../logger.js';
import { and, eq } from 'drizzle-orm';
import * as yaml from 'js-yaml';
import { getDbSync } from '../db/index.js';
import { clusters } from '../db/schema.js';
import { decryptLegacyXorKubeconfig, encryptKubeconfig } from './encryption.js';
import { getAllClusters } from './repository.js';

/**
 * Migrate all kubeconfigs to the new AES-256-GCM (v2) format
 */
type ClusterRecord = Awaited<ReturnType<typeof getAllClusters>>[number];
type Database = ReturnType<typeof getDbSync>;
type MigrationResult = 'migrated' | 'failed' | 'skipped';

function isValidKubeconfig(value: unknown): boolean {
	return (
		value !== null &&
		typeof value === 'object' &&
		'apiVersion' in value &&
		'clusters' in value &&
		'contexts' in value
	);
}

async function migrateCluster(db: Database, cluster: ClusterRecord): Promise<MigrationResult> {
	const encrypted = cluster.kubeconfigEncrypted;
	if (!encrypted || encrypted.startsWith('v2:')) return 'skipped';

	try {
		const plaintext = decryptLegacyXorKubeconfig(encrypted);

		// Validate before overwriting: wrong-key XOR output must preserve the original ciphertext.
		let parsed: unknown;
		try {
			parsed = yaml.load(plaintext);
		} catch {
			logger.error(
				`Skipping migration for cluster ${cluster.name}: decrypted content is not valid YAML — original ciphertext preserved`
			);
			return 'failed';
		}

		if (!isValidKubeconfig(parsed)) {
			logger.error(
				`Skipping migration for cluster ${cluster.name}: decrypted content is missing required kubeconfig fields — original ciphertext preserved`
			);
			return 'failed';
		}

		const updatedRows = await db
			.update(clusters)
			.set({
				kubeconfigEncrypted: encryptKubeconfig(plaintext),
				updatedAt: new Date()
			})
			.where(and(eq(clusters.id, cluster.id), eq(clusters.kubeconfigEncrypted, encrypted)))
			.returning({ id: clusters.id });

		if (updatedRows.length === 0) {
			logger.warn(
				`Skipping migration for cluster ${cluster.name}: kubeconfig changed during migration`
			);
			return 'failed';
		}

		return 'migrated';
	} catch (error) {
		logger.error(error, `Failed to migrate kubeconfig for cluster ${cluster.name}:`);
		return 'failed';
	}
}

export async function migrateKubeconfigs(): Promise<{ migrated: number; failed: number }> {
	const db = getDbSync();
	const allClusters = await getAllClusters();
	let migrated = 0;
	let failed = 0;

	for (const cluster of allClusters) {
		const result = await migrateCluster(db, cluster);
		if (result === 'migrated') migrated++;
		if (result === 'failed') failed++;
	}

	return { migrated, failed };
}
