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

type ClusterRecord = Awaited<ReturnType<typeof getClusterById>>;

async function createFailedConnectionResult(
	id: string,
	cluster: ClusterRecord,
	clusterName: string,
	checks: HealthCheckResult[],
	details: string | undefined,
	extraChecks: HealthCheckResult[] = []
): Promise<ClusterHealthCheck> {
	if (cluster) await updateCluster(id, { lastError: details });
	return {
		connected: false,
		clusterName,
		checks: [...checks, ...extraChecks],
		error: details,
		timestamp: new Date()
	};
}

async function runConnectionDiagnostics(
	id: string,
	cluster: ClusterRecord,
	clusterName: string,
	checks: HealthCheckResult[]
): Promise<ClusterHealthCheck> {
	const kubeconfig = await getClusterKubeconfig(id);
	if (!kubeconfig) {
		const error = 'Kubeconfig not found or failed to decrypt';
		return createFailedConnectionResult(id, cluster, clusterName, checks, error, [
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
		return createFailedConnectionResult(id, cluster, clusterName, checks, parseCheck.details);
	}

	const diagnostics = await runClusterHealthChecks(kc);
	checks.push(...diagnostics.checks);
	if (!diagnostics.connected) {
		return createFailedConnectionResult(id, cluster, clusterName, checks, diagnostics.error);
	}

	if (cluster) await updateCluster(id, { lastConnectedAt: new Date(), lastError: null });
	return {
		connected: true,
		clusterName,
		kubernetesVersion: diagnostics.kubernetesVersion,
		checks,
		timestamp: new Date()
	};
}

async function createUnexpectedFailureResult(
	id: string,
	cluster: ClusterRecord,
	clusterName: string,
	checks: HealthCheckResult[],
	unexpectedError: unknown
): Promise<ClusterHealthCheck> {
	const error = unexpectedError instanceof Error ? unexpectedError.message : 'Unexpected error';
	const sanitizedError = sanitizeK8sErrorMessage(error);
	if (cluster) await updateCluster(id, { lastError: sanitizedError });
	return { connected: false, clusterName, checks, error: sanitizedError, timestamp: new Date() };
}

/**
 * Test cluster connection with detailed health diagnostics
 */
export async function testClusterConnection(id: string): Promise<ClusterHealthCheck> {
	const cluster = await getClusterById(id);
	const clusterName = cluster?.name || 'Unknown';
	const checks: HealthCheckResult[] = [];

	try {
		return await runConnectionDiagnostics(id, cluster, clusterName, checks);
	} catch (unexpectedError) {
		return createUnexpectedFailureResult(id, cluster, clusterName, checks, unexpectedError);
	}
}
