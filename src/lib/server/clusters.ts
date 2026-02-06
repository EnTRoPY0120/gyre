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

const ALGORITHM = 'aes-256-gcm';

/**
 * Encrypt kubeconfig string using AES-256-GCM
 * Format: v2:iv:ciphertext:authTag (all hex except v2 prefix)
 */
function encryptKubeconfig(kubeconfig: string): string {
	const iv = crypto.randomBytes(16);
	const key = Buffer.from(ENCRYPTION_KEY, 'hex'); // We validated it's 32 bytes hex

	const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

	let encrypted = cipher.update(kubeconfig, 'utf8', 'hex');
	encrypted += cipher.final('hex');

	const authTag = cipher.getAuthTag();

	// Return format: v2:iv:ciphertext:authTag
	return `v2:${iv.toString('hex')}:${encrypted}:${authTag.toString('hex')}`;
}

/**
 * Decrypt kubeconfig string
 * Supports both old XOR format and new AES-256-GCM (v2) format
 */
function decryptKubeconfig(encrypted: string): string {
	// Check if it's the new v2 format
	if (encrypted.startsWith('v2:')) {
		const parts = encrypted.split(':');
		if (parts.length !== 4) {
			throw new Error('Invalid v2 encrypted kubeconfig format');
		}

		const [, ivHex, ciphertext, authTagHex] = parts;
		const key = Buffer.from(ENCRYPTION_KEY, 'hex');
		const iv = Buffer.from(ivHex, 'hex');
		const authTag = Buffer.from(authTagHex, 'hex');

		const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
		decipher.setAuthTag(authTag);

		let decrypted = decipher.update(ciphertext, 'hex', 'utf8');
		decrypted += decipher.final('utf8');
		return decrypted;
	}

	// Fallback to old XOR encryption for backward compatibility during migration
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
 * Health check result for a single diagnostic test
 */
export interface HealthCheckResult {
	name: string;
	passed: boolean;
	message: string;
	details?: string;
	duration?: number;
}

/**
 * Detailed cluster connection test result
 */
export interface ClusterHealthCheck {
	connected: boolean;
	clusterName: string;
	kubernetesVersion?: string;
	checks: HealthCheckResult[];
	error?: string;
	timestamp: Date;
}

/**
 * Test cluster connection with detailed health diagnostics
 */
export async function testClusterConnection(id: string): Promise<ClusterHealthCheck> {
	const cluster = await getClusterById(id);
	const clusterName = cluster?.name || 'Unknown';
	const checks: HealthCheckResult[] = [];
	let kubernetesVersion: string | undefined;

	try {
		const kubeconfig = await getClusterKubeconfig(id);
		if (!kubeconfig) {
			const error = 'Kubeconfig not found or failed to decrypt';
			if (cluster) {
				await updateCluster(id, { lastError: error });
			}
			return {
				connected: false,
				clusterName,
				checks: [
					{
						name: 'Kubeconfig Access',
						passed: false,
						message: 'Failed to retrieve kubeconfig',
						details: error
					}
				],
				error,
				timestamp: new Date()
			};
		}

		const kc = new k8s.KubeConfig();

		// Test 1: Parse kubeconfig
		const parseStart = Date.now();
		try {
			kc.loadFromString(kubeconfig);
			checks.push({
				name: 'Kubeconfig Parse',
				passed: true,
				message: 'Kubeconfig is valid YAML/JSON',
				duration: Date.now() - parseStart
			});
		} catch (parseError) {
			const error = parseError instanceof Error ? parseError.message : 'Invalid kubeconfig format';
			checks.push({
				name: 'Kubeconfig Parse',
				passed: false,
				message: 'Failed to parse kubeconfig',
				details: error,
				duration: Date.now() - parseStart
			});

			if (cluster) {
				await updateCluster(id, { lastError: error });
			}

			return {
				connected: false,
				clusterName,
				checks,
				error,
				timestamp: new Date()
			};
		}

		// Test 2: API Server Reachability
		const networkStart = Date.now();
		try {
			const coreApi = kc.makeApiClient(k8s.CoreV1Api);
			// Get server info first (lightweight call)
			await coreApi.getAPIResources();

			checks.push({
				name: 'API Server Reachability',
				passed: true,
				message: 'Successfully connected to Kubernetes API server',
				duration: Date.now() - networkStart
			});
		} catch (networkError) {
			const error = networkError instanceof Error ? networkError.message : 'Network error';
			let details = error;

			// Provide more helpful error messages for common network issues
			if (error.includes('ENOTFOUND') || error.includes('getaddrinfo')) {
				details = 'DNS resolution failed. Check if the server address in kubeconfig is correct.';
			} else if (error.includes('ECONNREFUSED') || error.includes('ECONNRESET')) {
				details =
					'Connection refused. Check if the Kubernetes API server is running and accessible.';
			} else if (error.includes('ETIMEDOUT') || error.includes('timeout')) {
				details = 'Connection timed out. Check network connectivity and firewall rules.';
			}

			checks.push({
				name: 'API Server Reachability',
				passed: false,
				message: 'Failed to reach Kubernetes API server',
				details,
				duration: Date.now() - networkStart
			});

			if (cluster) {
				await updateCluster(id, { lastError: details });
			}

			return {
				connected: false,
				clusterName,
				checks,
				error: details,
				timestamp: new Date()
			};
		}

		// Test 3: Authentication & Version Check
		const authStart = Date.now();
		try {
			const coreApi = kc.makeApiClient(k8s.CoreV1Api);
			// Try to get server info - this validates authentication
			const namespaces = await coreApi.listNamespace();
			// If we get here, authentication worked

			// Extract version info from the first namespace's metadata (if available)
			// or we'll check it separately
			const currentUser = kc.getCurrentUser();
			const userInfo = currentUser ? `User: ${currentUser.name}` : 'ServiceAccount';

			checks.push({
				name: 'Authentication',
				passed: true,
				message: 'Authentication successful',
				details: userInfo,
				duration: Date.now() - authStart
			});

			// Store namespaces for authorization check
			const namespaceCount = Array.isArray(namespaces)
				? namespaces.length
				: namespaces.items?.length || 0;

			// Test 4: Authorization Check (Can list namespaces?)
			checks.push({
				name: 'Authorization',
				passed: true,
				message: 'Successfully listed namespaces',
				details: `Access to ${namespaceCount} namespace(s) confirmed`,
				duration: Date.now() - authStart
			});

			// Test 5: Kubernetes Version Check
			const versionStart = Date.now();
			try {
				const versionApi = kc.makeApiClient(k8s.VersionApi);
				const versionResponse = await versionApi.getCode();
				kubernetesVersion = versionResponse.gitVersion;

				checks.push({
					name: 'Kubernetes Version',
					passed: true,
					message: `Cluster version detected: ${kubernetesVersion}`,
					duration: Date.now() - versionStart
				});
			} catch {
				// Version check is optional but helpful
				checks.push({
					name: 'Kubernetes Version',
					passed: true, // Still "passed" because core connectivity worked
					message: 'Connected, but failed to retrieve detailed version info',
					duration: Date.now() - versionStart
				});
			}
		} catch (authError) {
			const error = authError instanceof Error ? authError.message : 'Authentication error';
			let details = error;

			if (error.includes('Unauthorized') || error.includes('401')) {
				details =
					'Authentication failed. Check if the token/certificate in kubeconfig is valid and not expired.';
			} else if (error.includes('Forbidden') || error.includes('403')) {
				details =
					'Authorization failed. The user/service account does not have permission to list namespaces. Gyre requires at least namespace listing permissions.';
			} else if (error.includes('certificate') || error.includes('x509')) {
				details = 'Certificate error. Check if the CA certificate is valid and matches the server.';
			}

			// Determine if it's auth or authz failure
			const isAuthFailure =
				error.includes('Unauthorized') || error.includes('401') || error.includes('certificate');

			checks.push({
				name: isAuthFailure ? 'Authentication' : 'Authorization',
				passed: false,
				message: isAuthFailure ? 'Authentication failed' : 'Authorization failed',
				details,
				duration: Date.now() - authStart
			});

			if (cluster) {
				await updateCluster(id, { lastError: details });
			}

			return {
				connected: false,
				clusterName,
				checks,
				error: details,
				timestamp: new Date()
			};
		}

		// All checks passed!
		if (cluster) {
			await updateCluster(id, {
				lastConnectedAt: new Date(),
				lastError: null
			});
		}

		return {
			connected: true,
			clusterName,
			kubernetesVersion,
			checks,
			timestamp: new Date()
		};
	} catch (unexpectedError) {
		const error = unexpectedError instanceof Error ? unexpectedError.message : 'Unexpected error';

		if (cluster) {
			await updateCluster(id, { lastError: error });
		}

		return {
			connected: false,
			clusterName,
			checks,
			error,
			timestamp: new Date()
		};
	}
}

/**
 * Migrate all kubeconfigs to the new AES-256-GCM (v2) format
 */
export async function migrateKubeconfigs(): Promise<number> {
	const db = getDbSync();
	const allClusters = await getAllClusters();
	let migratedCount = 0;

	for (const cluster of allClusters) {
		if (cluster.kubeconfigEncrypted && !cluster.kubeconfigEncrypted.startsWith('v2:')) {
			try {
				// Decrypt using old format (handled by decryptKubeconfig)
				const plaintext = decryptKubeconfig(cluster.kubeconfigEncrypted);
				// Re-encrypt using new format
				const reEncrypted = encryptKubeconfig(plaintext);

				await db
					.update(clusters)
					.set({
						kubeconfigEncrypted: reEncrypted,
						updatedAt: new Date()
					})
					.where(eq(clusters.id, cluster.id));

				migratedCount++;
			} catch (error) {
				console.error(`Failed to migrate kubeconfig for cluster ${cluster.name}:`, error);
			}
		}
	}

	return migratedCount;
}

export type { NewCluster, NewClusterContext };
