import { logger } from '../logger.js';
import * as k8s from '@kubernetes/client-node';
import type { User } from '../db/index.js';
import {
	generateStrongPassword,
	hashPassword,
	normalizeUsername,
	validateAdminPasswordStrength,
	verifyPassword
} from './passwords.js';
import { getCurrentNamespace } from '../kubernetes/namespace.js';

const ADMIN_SECRET_NAME = 'gyre-initial-admin-secret';

let inClusterAdminPasswordHash: string | null = null;
let inClusterFirstLoginDone = false;

export function isInClusterMode(): boolean {
	return !!process.env.KUBERNETES_SERVICE_HOST;
}

export function isInClusterAdmin(user: User): boolean {
	return normalizeUsername(user.username) === 'admin' && isInClusterMode();
}

// Create Kubernetes Core API client (works both in-cluster and locally)
async function createK8sClient(): Promise<k8s.CoreV1Api> {
	const { loadKubeConfig } = await import('../kubernetes/config.js');
	const kc = loadKubeConfig();
	return kc.makeApiClient(k8s.CoreV1Api);
}

/**
 * Check if the initial admin secret has been marked as consumed
 */
async function isSecretConsumed(api: k8s.CoreV1Api, namespace: string): Promise<boolean> {
	try {
		const result = await api.readNamespacedSecret({
			name: ADMIN_SECRET_NAME,
			namespace
		});
		const labels = result.metadata?.labels || {};
		return labels['gyre.io/initial-password-consumed'] === 'true';
	} catch {
		// If secret doesn't exist, it's not consumed
		return false;
	}
}

/**
 * Mark the initial admin secret as consumed after first login
 */
async function markSecretConsumed(api: k8s.CoreV1Api, namespace: string): Promise<void> {
	// Patch the secret to add the consumed label using JSON Patch format
	const patch = [
		{
			op: 'add',
			path: '/metadata/labels/gyre.io~1initial-password-consumed',
			value: 'true'
		}
	];
	await api.patchNamespacedSecret({
		name: ADMIN_SECRET_NAME,
		namespace,
		body: patch
	});
}

/**
 * Load or create in-cluster admin password from Kubernetes secret
 * - If secret exists and has password: load it
 * - If secret doesn't exist: generate password and create secret
 * - Returns the plaintext password (for initial display only)
 */
export async function loadOrCreateInClusterAdmin(): Promise<string | null> {
	try {
		const api = await createK8sClient();
		const namespace = getCurrentNamespace();

		// Check if secret already exists
		try {
			const result = await api.readNamespacedSecret({
				name: ADMIN_SECRET_NAME,
				namespace
			});
			const passwordBase64 = result.data?.['password'];

			if (passwordBase64) {
				const password = Buffer.from(passwordBase64, 'base64').toString('utf-8');
				// Hash and store for authentication
				inClusterAdminPasswordHash = await hashPassword(password);

				// Check if already consumed
				inClusterFirstLoginDone = await isSecretConsumed(api, namespace);

				return password;
			}
		} catch (error: unknown) {
			// Secret doesn't exist, will create it below
			const k8sError = error as Error & { code?: number };
			if (k8sError.code !== 404) {
				throw error;
			}
		}

		// Generate new password
		// Use ADMIN_PASSWORD from env if provided, otherwise generate a strong one
		const password = process.env.ADMIN_PASSWORD || generateStrongPassword();
		if (process.env.ADMIN_PASSWORD) {
			validateAdminPasswordStrength(process.env.ADMIN_PASSWORD, true);
		}

		// Hash for storage
		inClusterAdminPasswordHash = await hashPassword(password);

		// Create the secret
		const secret: k8s.V1Secret = {
			apiVersion: 'v1',
			kind: 'Secret',
			metadata: {
				name: ADMIN_SECRET_NAME,
				namespace,
				labels: {
					'app.kubernetes.io/managed-by': 'gyre',
					'gyre.io/secret-type': 'initial-admin-password'
				}
			},
			stringData: {
				password: password
			}
		};

		await api.createNamespacedSecret({
			namespace,
			body: secret
		});
		logger.info(`Created initial admin secret in namespace "${namespace}"`);

		return password;
	} catch (error) {
		logger.error(
			error,
			'Failed to setup in-cluster admin. Fix the gyre-initial-admin-secret name, namespace, or Kubernetes RBAC permissions and restart Gyre:'
		);
		throw error;
	}
}

/**
 * Validate admin login for in-cluster mode
 * - Checks against the K8s secret password
 * - After first successful login, marks secret as consumed
 */
export async function validateInClusterAdmin(password: string): Promise<boolean> {
	if (!inClusterAdminPasswordHash) {
		// Try to load from secret if not already loaded
		await loadOrCreateInClusterAdmin();
	}

	if (!inClusterAdminPasswordHash) {
		return false;
	}

	const isValid = await verifyPassword(password, inClusterAdminPasswordHash);

	if (isValid && !inClusterFirstLoginDone) {
		// Mark as consumed
		try {
			const api = await createK8sClient();
			const namespace = getCurrentNamespace();
			await markSecretConsumed(api, namespace);
			inClusterFirstLoginDone = true;
		} catch (error) {
			logger.error(error, 'Failed to mark secret as consumed:');
		}
	}

	return isValid;
}

/**
 * Check if in-cluster admin password has been used
 */
export function isInClusterAdminPasswordConsumed(): boolean {
	return inClusterFirstLoginDone;
}
