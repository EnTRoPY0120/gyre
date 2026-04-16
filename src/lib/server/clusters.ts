import { logger } from './logger.js';
import { IN_CLUSTER_ID, type ClusterOption } from '$lib/clusters/identity.js';
import { eq, desc, or, sql } from 'drizzle-orm';
import { getDbSync } from './db/index.js';
import { getPaginatedItems, sanitizeSearchInput } from './db/utils.js';
import { clusters, clusterContexts, type NewCluster, type NewClusterContext } from './db/schema.js';
import * as k8s from '@kubernetes/client-node';
import crypto from 'node:crypto';
import yaml from 'js-yaml';
import { sanitizeK8sErrorMessage } from './kubernetes/errors.js';

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
		const devKey = crypto.randomBytes(32).toString('hex');
		logger.warn(
			'⚠️  GYRE_ENCRYPTION_KEY not set! Using ephemeral random key. Encrypted kubeconfigs will be unreadable after restart. Set GYRE_ENCRYPTION_KEY to persist.'
		);
		return devKey;
	}

	// Validate key format (should be 64 hex characters = 32 bytes)
	if (!/^[0-9a-f]{64}$/i.test(key)) {
		throw new Error(
			'GYRE_ENCRYPTION_KEY must be 64 hexadecimal characters (32 bytes). Generate with: openssl rand -hex 32'
		);
	}

	return key;
}

let _encryptionKey: string | null = null;

function getEncryptionKeyLazy(): string {
	if (!_encryptionKey) {
		_encryptionKey = getEncryptionKey();
	}
	return _encryptionKey;
}

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
	const key = Buffer.from(getEncryptionKeyLazy(), 'hex'); // We validated it's 32 bytes hex

	const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

	let encrypted = cipher.update(kubeconfig, 'utf8', 'hex');
	encrypted += cipher.final('hex');

	const authTag = cipher.getAuthTag();

	// Return format: v2:iv:ciphertext:authTag
	return `v2:${iv.toString('hex')}:${encrypted}:${authTag.toString('hex')}`;
}

/**
 * Decrypt kubeconfig encrypted with legacy XOR cipher.
 * Used only by migrateKubeconfigs() to read pre-migration records.
 */
function decryptLegacyXorKubeconfig(encrypted: string): string {
	const buffer = Buffer.from(encrypted, 'base64');
	const decrypted = Buffer.alloc(buffer.length);
	const key = getEncryptionKeyLazy();
	for (let i = 0; i < buffer.length; i++) {
		decrypted[i] = buffer[i] ^ key.charCodeAt(i % key.length);
	}
	return decrypted.toString('utf-8');
}

/**
 * Decrypt kubeconfig string.
 * Only AES-256-GCM (v2) format is supported.
 */
function decryptKubeconfig(encrypted: string): string {
	// Check if it's the new v2 format
	if (encrypted.startsWith('v2:')) {
		const parts = encrypted.split(':');
		if (parts.length !== 4) {
			throw new Error('Invalid v2 encrypted kubeconfig format');
		}

		const [, ivHex, ciphertext, authTagHex] = parts;
		const key = Buffer.from(getEncryptionKeyLazy(), 'hex');
		const iv = Buffer.from(ivHex, 'hex');
		const authTag = Buffer.from(authTagHex, 'hex');

		const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
		decipher.setAuthTag(authTag);

		let decrypted = decipher.update(ciphertext, 'hex', 'utf8');
		decrypted += decipher.final('utf8');
		return decrypted;
	}

	throw new Error(
		'Unsupported kubeconfig encryption format: only v2 (AES-256-GCM) is supported. ' +
			'Run migrateKubeconfigs() to upgrade any legacy records.'
	);
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
	} catch {
		logger.error('Failed to parse kubeconfig: parse error (sanitized)');
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
	const uniqueContexts = [...new Set(contexts)];

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
	const db = getDbSync();
	return db.query.clusters.findMany({
		orderBy: [desc(clusters.createdAt)]
	});
}

/**
 * Get selectable cluster identities for UI/API selection.
 * Kubeconfig context names are diagnostic metadata only; uploaded clusters are
 * selected by their stable clusters.id values.
 */
export async function getSelectableClusters(
	_selectedClusterId: string,
	currentContext?: string | null
): Promise<ClusterOption[]> {
	const uploadedClusters = (await getAllClusters()).filter((cluster) => cluster.isActive);

	return [
		{
			id: IN_CLUSTER_ID,
			name: 'In-cluster',
			description: 'Runtime Kubernetes configuration',
			source: 'in-cluster',
			isActive: true,
			currentContext
		},
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

function checkKubeconfigParse(kubeconfig: string): {
	check: HealthCheckResult;
	kc?: k8s.KubeConfig;
} {
	const kc = new k8s.KubeConfig();
	const start = Date.now();
	try {
		kc.loadFromString(kubeconfig);
		return {
			check: {
				name: 'Kubeconfig Parse',
				passed: true,
				message: 'Kubeconfig is valid YAML/JSON',
				duration: Date.now() - start
			},
			kc
		};
	} catch (parseError) {
		const error = parseError instanceof Error ? parseError.message : 'Invalid kubeconfig format';
		return {
			check: {
				name: 'Kubeconfig Parse',
				passed: false,
				message: 'Failed to parse kubeconfig',
				details: sanitizeK8sErrorMessage(error),
				duration: Date.now() - start
			}
		};
	}
}

async function checkApiReachability(kc: k8s.KubeConfig): Promise<HealthCheckResult> {
	const start = Date.now();
	try {
		const coreApi = kc.makeApiClient(k8s.CoreV1Api);
		await coreApi.getAPIResources();
		return {
			name: 'API Server Reachability',
			passed: true,
			message: 'Successfully connected to Kubernetes API server',
			duration: Date.now() - start
		};
	} catch (networkError) {
		const error = networkError instanceof Error ? networkError.message : 'Network error';

		// Auth/cert/authz errors must bubble up to checkAuthAndVersion for proper diagnosis
		if (
			error.includes('Unauthorized') ||
			error.includes('401') ||
			error.includes('Forbidden') ||
			error.includes('403') ||
			error.includes('certificate') ||
			error.includes('x509')
		) {
			throw networkError;
		}

		let details = error;
		if (error.includes('ENOTFOUND') || error.includes('getaddrinfo')) {
			details = 'DNS resolution failed. Check if the server address in kubeconfig is correct.';
		} else if (error.includes('ECONNREFUSED') || error.includes('ECONNRESET')) {
			details = 'Connection refused. Check if the Kubernetes API server is running and accessible.';
		} else if (error.includes('ETIMEDOUT') || error.includes('timeout')) {
			details = 'Connection timed out. Check network connectivity and firewall rules.';
		}

		return {
			name: 'API Server Reachability',
			passed: false,
			message: 'Failed to reach Kubernetes API server',
			details: sanitizeK8sErrorMessage(details),
			duration: Date.now() - start
		};
	}
}

async function checkAuthAndVersion(
	kc: k8s.KubeConfig
): Promise<{ checks: HealthCheckResult[]; version?: string; error?: string }> {
	const authStart = Date.now();
	const checks: HealthCheckResult[] = [];

	try {
		const coreApi = kc.makeApiClient(k8s.CoreV1Api);
		await coreApi.listNamespace({ limit: 1 });

		const currentUser = kc.getCurrentUser();
		const userInfo = currentUser ? `User: ${currentUser.name}` : 'ServiceAccount';

		checks.push({
			name: 'Authentication',
			passed: true,
			message: 'Authentication successful',
			details: userInfo,
			duration: Date.now() - authStart
		});
		checks.push({
			name: 'Authorization',
			passed: true,
			message: 'Successfully listed namespaces',
			details: 'Namespace access confirmed',
			duration: Date.now() - authStart
		});

		// Version check is optional
		const versionStart = Date.now();
		try {
			const versionApi = kc.makeApiClient(k8s.VersionApi);
			const versionResponse = await versionApi.getCode();
			const version = versionResponse.gitVersion;
			checks.push({
				name: 'Kubernetes Version',
				passed: true,
				message: `Cluster version detected: ${version}`,
				duration: Date.now() - versionStart
			});
			return { checks, version };
		} catch {
			checks.push({
				name: 'Kubernetes Version',
				passed: false,
				message: 'Connected, but failed to retrieve detailed version info',
				duration: Date.now() - versionStart
			});
			return { checks };
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

		const isAuthFailure =
			error.includes('Unauthorized') ||
			error.includes('401') ||
			error.includes('certificate') ||
			error.includes('x509');
		const sanitizedDetails = sanitizeK8sErrorMessage(details);

		checks.push({
			name: isAuthFailure ? 'Authentication' : 'Authorization',
			passed: false,
			message: isAuthFailure ? 'Authentication failed' : 'Authorization failed',
			details: sanitizedDetails,
			duration: Date.now() - authStart
		});
		return { checks, error: sanitizedDetails };
	}
}

/**
 * Test cluster connection with detailed health diagnostics
 */
export async function testClusterConnection(id: string): Promise<ClusterHealthCheck> {
	const cluster = await getClusterById(id);
	const clusterName = cluster?.name || 'Unknown';
	const checks: HealthCheckResult[] = [];

	async function fail(
		details: string | undefined,
		extraChecks?: HealthCheckResult[]
	): Promise<ClusterHealthCheck> {
		if (cluster) await updateCluster(id, { lastError: details });
		return {
			connected: false,
			clusterName,
			checks: [...checks, ...(extraChecks ?? [])],
			error: details,
			timestamp: new Date()
		};
	}

	try {
		const kubeconfig = await getClusterKubeconfig(id);
		if (!kubeconfig) {
			const error = 'Kubeconfig not found or failed to decrypt';
			return await fail(error, [
				{
					name: 'Kubeconfig Access',
					passed: false,
					message: 'Failed to retrieve kubeconfig',
					details: error
				}
			]);
		}

		const { check: parseCheck, kc } = checkKubeconfigParse(kubeconfig);
		checks.push(parseCheck);
		if (!parseCheck.passed || !kc) {
			return await fail(parseCheck.details);
		}

		let reachabilityCheck: HealthCheckResult;
		try {
			reachabilityCheck = await checkApiReachability(kc);
		} catch {
			// Server responded with an auth/cert/authz error — it is reachable, so let
			// checkAuthAndVersion produce the proper diagnostic instead of a network failure
			const authResult = await checkAuthAndVersion(kc);
			checks.push(...authResult.checks);
			return await fail(authResult.error);
		}
		checks.push(reachabilityCheck);
		if (!reachabilityCheck.passed) {
			return await fail(reachabilityCheck.details);
		}

		const authResult = await checkAuthAndVersion(kc);
		checks.push(...authResult.checks);
		if (authResult.error) {
			return await fail(authResult.error);
		}

		if (cluster) await updateCluster(id, { lastConnectedAt: new Date(), lastError: null });
		return {
			connected: true,
			clusterName,
			kubernetesVersion: authResult.version,
			checks,
			timestamp: new Date()
		};
	} catch (unexpectedError) {
		const error = unexpectedError instanceof Error ? unexpectedError.message : 'Unexpected error';
		const sanitizedError = sanitizeK8sErrorMessage(error);
		if (cluster) await updateCluster(id, { lastError: sanitizedError });
		return { connected: false, clusterName, checks, error: sanitizedError, timestamp: new Date() };
	}
}

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

				await db
					.update(clusters)
					.set({
						kubeconfigEncrypted: reEncrypted,
						updatedAt: new Date()
					})
					.where(eq(clusters.id, cluster.id));

				migratedCount++;
			} catch (error) {
				logger.error(error, `Failed to migrate kubeconfig for cluster ${cluster.name}:`);
				failed++;
			}
		}
	}

	return { migrated: migratedCount, failed };
}

// Exported for testing only
export { decryptKubeconfig as _decryptKubeconfig };
export function _resetEncryptionKeyCache(): void {
	_encryptionKey = null;
}

export type { NewCluster, NewClusterContext };
