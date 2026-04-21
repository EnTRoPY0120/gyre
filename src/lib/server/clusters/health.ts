import * as k8s from '@kubernetes/client-node';
import { sanitizeK8sErrorMessage } from '../kubernetes/errors.js';
import { getClusterById, getClusterKubeconfig, updateCluster } from './repository.js';

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
