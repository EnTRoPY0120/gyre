import { eq, desc } from 'drizzle-orm';
import { getDbSync } from './db/index.js';
import { clusters, clusterContexts, type NewCluster, type NewClusterContext } from './db/schema.js';
import * as k8s from '@kubernetes/client-node';

// Simple encryption key - in production this should be from environment/config
const ENCRYPTION_KEY = process.env.GYRE_ENCRYPTION_KEY || 'default-key-change-in-production';

/**
 * Encrypt kubeconfig string
 * Simple XOR encryption for now - replace with AES-256-GCM in production
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
