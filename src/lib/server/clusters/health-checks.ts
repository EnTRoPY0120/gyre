import * as k8s from '@kubernetes/client-node';
import { sanitizeK8sErrorMessage } from '../kubernetes/errors.js';
import { makeApiClientWithTimeout } from '../kubernetes/client-factory.js';
import { OPERATION_TIMEOUTS } from '../kubernetes/timeouts.js';
import type { HealthCheckResult } from './health.js';
import {
	describeAuthenticationFailure,
	describeReachabilityError,
	isAuthenticationRelatedError
} from './health-helpers.js';

export interface ClusterHealthDiagnostics {
	connected: boolean;
	checks: HealthCheckResult[];
	kubernetesVersion?: string;
	error?: string;
}

export function checkKubeconfigParse(kubeconfig: string): {
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
		const coreApi = makeApiClientWithTimeout(kc, k8s.CoreV1Api, OPERATION_TIMEOUTS.get);
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
		if (isAuthenticationRelatedError(error)) {
			throw networkError;
		}

		return {
			name: 'API Server Reachability',
			passed: false,
			message: 'Failed to reach Kubernetes API server',
			details: sanitizeK8sErrorMessage(describeReachabilityError(error)),
			duration: Date.now() - start
		};
	}
}

async function checkKubernetesVersion(
	kc: k8s.KubeConfig
): Promise<{ check: HealthCheckResult; version?: string }> {
	const versionStart = Date.now();
	try {
		const versionApi = makeApiClientWithTimeout(kc, k8s.VersionApi, OPERATION_TIMEOUTS.get);
		const version = (await versionApi.getCode()).gitVersion;
		return {
			check: {
				name: 'Kubernetes Version',
				passed: true,
				message: `Cluster version detected: ${version}`,
				duration: Date.now() - versionStart
			},
			version
		};
	} catch {
		return {
			check: {
				name: 'Kubernetes Version',
				passed: false,
				message: 'Connected, but failed to retrieve detailed version info',
				duration: Date.now() - versionStart
			}
		};
	}
}

async function checkAuthAndVersion(
	kc: k8s.KubeConfig
): Promise<{ checks: HealthCheckResult[]; version?: string; error?: string }> {
	const authStart = Date.now();
	const checks: HealthCheckResult[] = [];

	try {
		const coreApi = makeApiClientWithTimeout(kc, k8s.CoreV1Api, OPERATION_TIMEOUTS.list);
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

		const versionResult = await checkKubernetesVersion(kc);
		checks.push(versionResult.check);
		return { checks, version: versionResult.version };
	} catch (authError) {
		const error = authError instanceof Error ? authError.message : 'Authentication error';
		const failure = describeAuthenticationFailure(error);

		checks.push({
			name: failure.name,
			passed: false,
			message: failure.message,
			details: failure.details,
			duration: Date.now() - authStart
		});
		return { checks, error: failure.details };
	}
}

function buildHealthDiagnostics(
	checks: HealthCheckResult[],
	authResult: { checks: HealthCheckResult[]; version?: string; error?: string }
): ClusterHealthDiagnostics {
	const allChecks = [...checks, ...authResult.checks];
	return authResult.error
		? { connected: false, checks: allChecks, error: authResult.error }
		: { connected: true, checks: allChecks, kubernetesVersion: authResult.version };
}

export async function runClusterHealthChecks(
	kc: k8s.KubeConfig
): Promise<ClusterHealthDiagnostics> {
	const checks: HealthCheckResult[] = [];

	try {
		const reachabilityCheck = await checkApiReachability(kc);
		checks.push(reachabilityCheck);
		if (!reachabilityCheck.passed) {
			return { connected: false, checks, error: reachabilityCheck.details };
		}
	} catch {
		// The API is reachable when this throws; use the auth check for a precise diagnosis.
		const authResult = await checkAuthAndVersion(kc);
		return buildHealthDiagnostics(checks, authResult);
	}

	const authResult = await checkAuthAndVersion(kc);
	return buildHealthDiagnostics(checks, authResult);
}
