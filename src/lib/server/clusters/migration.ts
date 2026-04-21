import { logger } from '../logger.js';
import { and, eq } from 'drizzle-orm';
import yaml from 'js-yaml';
import { getDbSync } from '../db/index.js';
import { clusters } from '../db/schema.js';
import { decryptLegacyXorKubeconfig, encryptKubeconfig } from './encryption.js';
import { getAllClusters } from './repository.js';

/**
 * Migrate all kubeconfigs to the new AES-256-GCM (v2) format
 */
export async function migrateKubeconfigs(): Promise<{ migrated: number; failed: number }> {
	const db = getDbSync();
	const allClusters = await getAllClusters();
	let migratedCount = 0;
	let failed = 0;

	for (const cluster of allClusters) {
		if (cluster.kubeconfigEncrypted && !cluster.kubeconfigEncrypted.startsWith('v2:')) {
			try {
				// Decrypt using legacy XOR format
				const plaintext = decryptLegacyXorKubeconfig(cluster.kubeconfigEncrypted);

				// Validate the decrypted content before overwriting the stored ciphertext.
				// XOR decryption with the wrong key produces garbled bytes that would pass
				// re-encryption silently, destroying the original ciphertext permanently.
				let parsed: unknown;
				try {
					parsed = yaml.load(plaintext);
				} catch {
					logger.error(
						`Skipping migration for cluster ${cluster.name}: decrypted content is not valid YAML — original ciphertext preserved`
					);
					failed++;
					continue;
				}
				if (
					parsed === null ||
					typeof parsed !== 'object' ||
					!('apiVersion' in parsed) ||
					!('clusters' in parsed) ||
					!('contexts' in parsed)
				) {
					logger.error(
						`Skipping migration for cluster ${cluster.name}: decrypted content is missing required kubeconfig fields — original ciphertext preserved`
					);
					failed++;
					continue;
				}

				// Re-encrypt using new v2 format
				const reEncrypted = encryptKubeconfig(plaintext);

				const updatedRows = await db
					.update(clusters)
					.set({
						kubeconfigEncrypted: reEncrypted,
						updatedAt: new Date()
					})
					.where(
						and(
							eq(clusters.id, cluster.id),
							eq(clusters.kubeconfigEncrypted, cluster.kubeconfigEncrypted)
						)
					)
					.returning({ id: clusters.id });

				if (updatedRows.length === 0) {
					logger.warn(
						`Skipping migration for cluster ${cluster.name}: kubeconfig changed during migration`
					);
					failed++;
					continue;
				}

				migratedCount++;
			} catch (error) {
				logger.error(error, `Failed to migrate kubeconfig for cluster ${cluster.name}:`);
				failed++;
			}
		}
	}

	return { migrated: migratedCount, failed };
}
