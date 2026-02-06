import { eq, desc } from 'drizzle-orm';
import { getDbSync } from './db/index.js';
import { clusters, clusterContexts, type NewCluster, type NewClusterContext } from './db/schema.js';
import * as k8s from '@kubernetes/client-node';
import crypto from 'node:crypto';

/**
 * Get the encryption key for kubeconfigs from environment.
 * In production, this MUST be set via GYRE_ENCRYPTION_KEY env var.
 * For development, a default key is used.
 */
function getEncryptionKey(): string {
	const key = process.env.GYRE_ENCRYPTION_KEY;
	const isProd = process.env.NODE_ENV === 'production';

	if (!key) {
		if (isProd) {
			throw new Error(
				'GYRE_ENCRYPTION_KEY must be set in production! ' +
					'Please set it to a 64-character hexadecimal string.'
			);
		}
		console.warn(
			'⚠️  GYRE_ENCRYPTION_KEY not set! Using development-only key. DO NOT USE IN PRODUCTION!'
		);
		// Development-only default key (32 bytes hex)
		return '00112233445566778899aabbccddeeff00112233445566778899aabbccddeeff';
	}

	// Validate key format (should be 64 hex characters = 32 bytes)
	if (!/^[0-9a-f]{64}$/i.test(key)) {
		throw new Error(
			'GYRE_ENCRYPTION_KEY must be 64 hexadecimal characters (32 bytes). Generate with: openssl rand -hex 32'
		);
	}

	return key;
}

const ENCRYPTION_KEY = getEncryptionKey();

/**
 * Check if the encryption key is the insecure development default.
 */
export function isUsingDevelopmentKey(): boolean {
	return !process.env.GYRE_ENCRYPTION_KEY;
}

/**
 * Validate that encryption/decryption works correctly.
 */
export function testEncryption(): boolean {
	try {
		const testSecret = 'test-kubeconfig-' + crypto.randomUUID();
		const encrypted = encryptKubeconfig(testSecret);
		const decrypted = decryptKubeconfig(encrypted);
		return testSecret === decrypted;
	} catch {
		return false;
	}
}

/**
 * Encrypt kubeconfig string
 * Simple XOR encryption for now - replace with AES-256-GCM in Issue #8
 */
function encryptKubeconfig(kubeconfig: string): string {
	// For production, use proper AES-256-GCM encryption
	// This is a placeholder implementation
	const buffer = Buffer.from(kubeconfig);
	const encrypted = Buffer.alloc(buffer.length);
	for (let i = 0; i < buffer.length; i++) {
		encrypted[i] = buffer[i] ^ ENCRYPTION_KEY.charCodeAt(i % ENCRYPTION_KEY.length);
	}
	return encrypted.toString('base64');
}

/**
 * Decrypt kubeconfig string
 */
function decryptKubeconfig(encrypted: string): string {
	const buffer = Buffer.from(encrypted, 'base64');
	const decrypted = Buffer.alloc(buffer.length);
	for (let i = 0; i < buffer.length; i++) {
		decrypted[i] = buffer[i] ^ ENCRYPTION_KEY.charCodeAt(i % ENCRYPTION_KEY.length);
	}
	return decrypted.toString('utf-8');
}

/**
 * Parse kubeconfig and extract contexts
 */
function parseKubeconfig(kubeconfig: string): {
	contexts: string[];
	currentContext: string | null;
} {
	try {
		const kc = new k8s.KubeConfig();
		kc.loadFromString(kubeconfig);

		const contexts = kc.getContexts().map((ctx) => ctx.name);
		const currentContext = kc.getCurrentContext();

		return { contexts, currentContext };
	} catch (error) {
		console.error('Failed to parse kubeconfig:', error);
		return { contexts: [], currentContext: null };
	}
}

/**
 * Create a new cluster
 */
export async function createCluster(params: {
	name: string;
	description?: string;
	kubeconfig: string;
	isLocal: boolean;
}): Promise<typeof clusters.$inferSelect> {
	const db = getDbSync();

	const id = crypto.randomUUID();
	const encryptedKubeconfig = encryptKubeconfig(params.kubeconfig);
	const { contexts, currentContext } = parseKubeconfig(params.kubeconfig);

	// Create cluster
	const newCluster: NewCluster = {
		id,
		name: params.name,
		description: params.description || null,
		kubeconfigEncrypted: encryptedKubeconfig,
		isActive: true,
		isLocal: params.isLocal,
		contextCount: contexts.length,
		lastConnectedAt: null,
		lastError: null
	};

	await db.insert(clusters).values(newCluster);

	// Create context records
	for (const ctxName of contexts) {
		const contextRecord: NewClusterContext = {
			id: crypto.randomUUID(),
			clusterId: id,
			contextName: ctxName,
			isCurrent: ctxName === currentContext,
			server: null, // Could extract from kubeconfig if needed
			namespaceRestrictions: null
		};
		await db.insert(clusterContexts).values(contextRecord);
	}

	const cluster = await db.query.clusters.findFirst({
		where: eq(clusters.id, id)
	});

	if (!cluster) {
		throw new Error('Failed to create cluster');
	}

	return cluster;
}

/**
 * Get all clusters
 */
export async function getAllClusters(): Promise<(typeof clusters.$inferSelect)[]> {
	const db = getDbSync();
	return db.query.clusters.findMany({
		orderBy: [desc(clusters.createdAt)]
	});
}

/**
 * Get cluster by ID
 */
export async function getClusterById(id: string): Promise<typeof clusters.$inferSelect | null> {
	const db = getDbSync();
	const cluster = await db.query.clusters.findFirst({
		where: eq(clusters.id, id)
	});
	return cluster || null;
}

/**
 * Update cluster
 */
export async function updateCluster(
	id: string,
	updates: Partial<
		Pick<typeof clusters.$inferSelect, 'isActive' | 'description' | 'lastConnectedAt' | 'lastError'>
	>
): Promise<typeof clusters.$inferSelect | null> {
	const db = getDbSync();

	await db
		.update(clusters)
		.set({ ...updates, updatedAt: new Date() })
		.where(eq(clusters.id, id));

	return getClusterById(id);
}

/**
 * Delete cluster
 */
export async function deleteCluster(id: string): Promise<void> {
	const db = getDbSync();

	// Delete contexts first (cascade should handle this but being explicit)
	await db.delete(clusterContexts).where(eq(clusterContexts.clusterId, id));

	// Delete cluster
	await db.delete(clusters).where(eq(clusters.id, id));
}

/**
 * Get decrypted kubeconfig
 */
export async function getClusterKubeconfig(id: string): Promise<string | null> {
	const cluster = await getClusterById(id);
	if (!cluster || !cluster.kubeconfigEncrypted) {
		return null;
	}

	return decryptKubeconfig(cluster.kubeconfigEncrypted);
}

/**
 * Test cluster connection
 */
export async function testClusterConnection(id: string): Promise<{
	connected: boolean;
	clusterName: string;
	error?: string;
}> {
	try {
		const kubeconfig = await getClusterKubeconfig(id);
		if (!kubeconfig) {
			return { connected: false, clusterName: 'Unknown', error: 'Kubeconfig not found' };
		}

		const kc = new k8s.KubeConfig();
		kc.loadFromString(kubeconfig);

		const coreApi = kc.makeApiClient(k8s.CoreV1Api);

		// Try to list namespaces as a connection test
		await coreApi.listNamespace();

		// Update last connected timestamp
		const cluster = await getClusterById(id);
		if (cluster) {
			await updateCluster(id, {
				lastConnectedAt: new Date(),
				lastError: null
			});
		}

		return {
			connected: true,
			clusterName: cluster?.name || 'Unknown'
		};
	} catch (error) {
		const cluster = await getClusterById(id);
		const clusterName = cluster?.name || 'Unknown';
		const errorMessage = error instanceof Error ? error.message : 'Unknown error';

		// Update last error
		if (cluster) {
			await updateCluster(id, { lastError: errorMessage });
		}

		return {
			connected: false,
			clusterName,
			error: errorMessage
		};
	}
}

export type { NewCluster, NewClusterContext };