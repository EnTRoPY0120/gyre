import { IN_CLUSTER_ID, type ClusterOption } from '$lib/clusters/identity.js';
import crypto from 'node:crypto';
import { desc, eq, or, sql } from 'drizzle-orm';
import { getDb } from '../db/index.js';
import { getPaginatedItems, sanitizeSearchInput } from '../db/utils.js';
import { getLocalKubeconfigOptions, shouldUseLocalKubeconfigContexts } from './local-kubeconfig.js';
import {
	clusterContexts,
	clusters,
	type NewCluster,
	type NewClusterContext
} from '../db/schema.js';
import { encryptKubeconfig, decryptKubeconfig } from './encryption.js';
import { parseKubeconfig } from './kubeconfig.js';

/**
 * Create a new cluster
 */
export async function createCluster(params: {
	name: string;
	description?: string;
	kubeconfig: string;
	isLocal: boolean;
}): Promise<typeof clusters.$inferSelect> {
	const db = await getDb();

	const id = crypto.randomUUID();
	const { contexts, currentContext } = parseKubeconfig(params.kubeconfig);
	const uniqueContexts = [...new Set(contexts)];
	if (uniqueContexts.length === 0) {
		throw new Error('Invalid kubeconfig: no contexts found');
	}
	const encryptedKubeconfig = encryptKubeconfig(params.kubeconfig);

	// Create cluster
	const newCluster: NewCluster = {
		id,
		name: params.name,
		description: params.description || null,
		kubeconfigEncrypted: encryptedKubeconfig,
		isActive: true,
		isLocal: params.isLocal,
		contextCount: uniqueContexts.length,
		lastConnectedAt: null,
		lastError: null
	};
	const contextRecords: NewClusterContext[] = uniqueContexts.map((ctxName) => ({
		id: crypto.randomUUID(),
		clusterId: id,
		contextName: ctxName,
		isCurrent: ctxName === currentContext,
		server: null,
		namespaceRestrictions: null
	}));

	db.transaction((tx) => {
		tx.insert(clusters).values(newCluster).run();
		if (contextRecords.length > 0) {
			tx.insert(clusterContexts).values(contextRecords).run();
		}
	});

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
	const db = await getDb();
	return db.query.clusters.findMany({
		orderBy: [desc(clusters.createdAt)]
	});
}

/**
 * Get selectable cluster identities for UI/API selection.
 * Local development exposes kubeconfig contexts directly. Uploaded clusters are
 * selected by their stable clusters.id values.
 */
export async function getSelectableClusters(
	currentContext?: string | null
): Promise<ClusterOption[]> {
	const uploadedClusters = (await getAllClusters()).filter(
		(cluster) => cluster.isActive && cluster.isLocal
	);
	const localContextOptions = getLocalKubeconfigOptions(currentContext);
	const runtimeOptions: ClusterOption[] =
		shouldUseLocalKubeconfigContexts() && localContextOptions.length > 0
			? localContextOptions
			: [
					{
						id: IN_CLUSTER_ID,
						name: 'In-cluster',
						description: 'Runtime Kubernetes configuration',
						source: 'in-cluster',
						isActive: true,
						currentContext
					}
				];

	return [
		...runtimeOptions,
		...uploadedClusters.map((cluster) => ({
			id: cluster.id,
			name: cluster.name,
			description: cluster.description,
			source: 'uploaded' as const,
			isActive: cluster.isActive,
			currentContext: null
		}))
	];
}

/**
 * Get clusters with pagination and search
 */
export async function getAllClustersPaginated(options?: {
	search?: string;
	limit?: number;
	offset?: number;
}): Promise<{ clusters: (typeof clusters.$inferSelect)[]; total: number }> {
	const result = await getPaginatedItems<typeof clusters, typeof clusters.$inferSelect>(
		clusters,
		(db) => db.query.clusters,
		options,
		(search) => {
			const sanitized = sanitizeSearchInput(search);
			const pattern = `%${sanitized}%`;
			return or(
				sql`${clusters.name} LIKE ${pattern} ESCAPE '\\'`,
				sql`${clusters.description} LIKE ${pattern} ESCAPE '\\'`
			);
		}
	);

	return { clusters: result.items, total: result.total };
}

/**
 * Get cluster by ID
 */
export async function getClusterById(id: string): Promise<typeof clusters.$inferSelect | null> {
	const db = await getDb();
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
	const db = await getDb();

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
	const db = await getDb();

	await db.transaction((tx) => {
		// Delete contexts first (cascade should handle this but being explicit)
		tx.delete(clusterContexts).where(eq(clusterContexts.clusterId, id)).run();

		// Delete cluster
		tx.delete(clusters).where(eq(clusters.id, id)).run();
	});
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

export type { NewCluster, NewClusterContext };
