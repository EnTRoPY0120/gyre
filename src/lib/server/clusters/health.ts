import { sanitizeK8sErrorMessage } from '../kubernetes/errors.js';
import { getClusterById, getClusterKubeconfig, updateCluster } from './repository.js';
import { checkKubeconfigParse, runClusterHealthChecks } from './health-checks.js';

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

		const diagnostics = await runClusterHealthChecks(kc);
		checks.push(...diagnostics.checks);
		if (!diagnostics.connected) return await fail(diagnostics.error);

		if (cluster) await updateCluster(id, { lastConnectedAt: new Date(), lastError: null });
		return {
			connected: true,
			clusterName,
			kubernetesVersion: diagnostics.kubernetesVersion,
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
