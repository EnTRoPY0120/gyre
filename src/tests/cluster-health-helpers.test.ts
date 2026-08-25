import { beforeEach, describe, expect, test, vi } from 'vitest';
import * as k8s from '@kubernetes/client-node';

const mocks = vi.hoisted(() => ({
	makeApiClientWithTimeout: vi.fn()
}));

vi.mock('../lib/server/kubernetes/client-factory.js', () => mocks);

import {
	describeAuthenticationFailure,
	describeReachabilityError,
	isAuthenticationRelatedError
} from '../lib/server/clusters/health-helpers.js';
import {
	checkKubeconfigParse,
	runClusterHealthChecks
} from '../lib/server/clusters/health-checks.js';

const kubeconfig = {
	getCurrentUser: vi.fn().mockReturnValue(null)
} as unknown as import('@kubernetes/client-node').KubeConfig;

describe('cluster health diagnostics', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	test('classifies authentication and authorization failures', () => {
		expect(isAuthenticationRelatedError('request failed with 401')).toBe(true);
		expect(isAuthenticationRelatedError('connection refused')).toBe(false);
		expect(describeAuthenticationFailure('Forbidden: list namespaces')).toEqual({
			name: 'Authorization',
			message: 'Authorization failed',
			details:
				'Authorization failed. The user/service account does not have permission to list namespaces. Gyre requires at least namespace listing permissions.'
		});
	});

	test('maps common network errors to actionable details', () => {
		expect(describeReachabilityError('getaddrinfo ENOTFOUND api')).toContain(
			'DNS resolution failed'
		);
		expect(describeReachabilityError('ECONNREFUSED')).toContain('Connection refused');
		expect(describeReachabilityError('ETIMEDOUT')).toContain('Connection timed out');
	});

	test('reports kubeconfig parsing without leaking parser details into the UI message', () => {
		const valid = checkKubeconfigParse(`
apiVersion: v1
kind: Config
clusters:
  - name: test
    cluster:
      server: https://kubernetes.example
contexts:
  - name: test
    context:
      cluster: test
      user: test
current-context: test
users:
  - name: test
    user: {}
`);
		expect(valid.check).toMatchObject({
			name: 'Kubeconfig Parse',
			passed: true,
			message: 'Kubeconfig is valid YAML/JSON'
		});
		expect(valid.kc).toBeDefined();

		const invalid = checkKubeconfigParse('not: [valid');
		expect(invalid.check).toMatchObject({
			name: 'Kubeconfig Parse',
			passed: false,
			message: 'Failed to parse kubeconfig'
		});
	});

	test('reports a reachable cluster and its Kubernetes version', async () => {
		mocks.makeApiClientWithTimeout.mockImplementation((_kc, apiClass) => {
			if (apiClass === k8s.CoreV1Api) {
				return {
					getAPIResources: vi.fn().mockResolvedValue({}),
					listNamespace: vi.fn().mockResolvedValue({})
				};
			}
			return { getCode: vi.fn().mockResolvedValue({ gitVersion: 'v1.30.0' }) };
		});

		const result = await runClusterHealthChecks(kubeconfig);

		expect(result).toMatchObject({ connected: true, kubernetesVersion: 'v1.30.0' });
		expect(result.checks).toEqual(
			expect.arrayContaining([
				expect.objectContaining({ name: 'API Server Reachability', passed: true }),
				expect.objectContaining({ name: 'Authentication', passed: true }),
				expect.objectContaining({ name: 'Kubernetes Version', passed: true })
			])
		);
	});

	test('returns an authentication diagnostic when namespace access fails', async () => {
		mocks.makeApiClientWithTimeout.mockImplementation((_kc, apiClass) => {
			if (apiClass === k8s.CoreV1Api) {
				return {
					getAPIResources: vi.fn().mockRejectedValue(new Error('Forbidden')),
					listNamespace: vi.fn().mockRejectedValue(new Error('Forbidden'))
				};
			}
			return { getCode: vi.fn() };
		});

		const result = await runClusterHealthChecks(kubeconfig);

		expect(result).toMatchObject({ connected: false });
		expect(result.error).toContain('Authorization failed');
		expect(result.checks).toEqual(
			expect.arrayContaining([expect.objectContaining({ name: 'Authorization', passed: false })])
		);
	});

	test('keeps the connection healthy when version lookup is unavailable', async () => {
		mocks.makeApiClientWithTimeout.mockImplementation((_kc, apiClass) => {
			if (apiClass === k8s.CoreV1Api) {
				return {
					getAPIResources: vi.fn().mockResolvedValue({}),
					listNamespace: vi.fn().mockResolvedValue({})
				};
			}
			return { getCode: vi.fn().mockRejectedValue(new Error('version unavailable')) };
		});

		const result = await runClusterHealthChecks(kubeconfig);

		expect(result).toMatchObject({ connected: true });
		expect(result.checks).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					name: 'Kubernetes Version',
					passed: false,
					message: 'Connected, but failed to retrieve detailed version info'
				})
			])
		);
	});
});
