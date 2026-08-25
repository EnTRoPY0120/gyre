import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
	getClusterById: vi.fn(),
	getClusterKubeconfig: vi.fn(),
	updateCluster: vi.fn(),
	checkKubeconfigParse: vi.fn(),
	runClusterHealthChecks: vi.fn()
}));

vi.mock('../lib/server/clusters/repository.js', () => mocks);
vi.mock('../lib/server/clusters/health-checks.js', () => mocks);
vi.mock('../lib/server/kubernetes/errors.js', () => ({
	sanitizeK8sErrorMessage: (message: string) => `[sanitized] ${message}`
}));

import { testClusterConnection } from '../lib/server/clusters/health.js';

const cluster = { id: 'cluster-a', name: 'Production', lastError: null };
const parseSuccess = {
	check: { name: 'Kubeconfig Parse', passed: true, message: 'Kubeconfig is valid YAML/JSON' },
	kc: { currentContext: { name: 'production' } }
};

beforeEach(() => {
	vi.clearAllMocks();
	mocks.getClusterById.mockResolvedValue(cluster);
	mocks.getClusterKubeconfig.mockResolvedValue('valid kubeconfig');
	mocks.checkKubeconfigParse.mockReturnValue(parseSuccess);
	mocks.runClusterHealthChecks.mockResolvedValue({ connected: true, checks: [] });
});

afterEach(() => vi.restoreAllMocks());

describe('testClusterConnection', () => {
	test('reports missing kubeconfig and records the failure', async () => {
		mocks.getClusterKubeconfig.mockResolvedValue(null);

		const result = await testClusterConnection('cluster-a');

		expect(result).toMatchObject({
			connected: false,
			clusterName: 'Production',
			error: 'Kubeconfig not found or failed to decrypt'
		});
		expect(result.checks).toContainEqual(
			expect.objectContaining({ name: 'Kubeconfig Access', passed: false })
		);
		expect(mocks.updateCluster).toHaveBeenCalledWith('cluster-a', {
			lastError: 'Kubeconfig not found or failed to decrypt'
		});
	});

	test('stops after kubeconfig parsing fails', async () => {
		mocks.checkKubeconfigParse.mockReturnValue({
			check: {
				name: 'Kubeconfig Parse',
				passed: false,
				message: 'Failed to parse kubeconfig',
				details: 'bad config'
			}
		});

		const result = await testClusterConnection('cluster-a');

		expect(result).toMatchObject({ connected: false, error: 'bad config' });
		expect(result.checks).toHaveLength(1);
		expect(mocks.runClusterHealthChecks).not.toHaveBeenCalled();
	});

	test('records successful diagnostics and clears the previous error', async () => {
		mocks.runClusterHealthChecks.mockResolvedValue({
			connected: true,
			kubernetesVersion: 'v1.30.0',
			checks: [{ name: 'Authentication', passed: true, message: 'Authenticated' }]
		});

		const result = await testClusterConnection('cluster-a');

		expect(result).toMatchObject({
			connected: true,
			clusterName: 'Production',
			kubernetesVersion: 'v1.30.0'
		});
		expect(mocks.updateCluster).toHaveBeenCalledWith('cluster-a', {
			lastConnectedAt: expect.any(Date),
			lastError: null
		});
	});

	test('returns diagnostic failures and records their details', async () => {
		mocks.runClusterHealthChecks.mockResolvedValue({
			connected: false,
			checks: [{ name: 'Authorization', passed: false, message: 'Forbidden' }],
			error: 'Authorization failed'
		});

		const result = await testClusterConnection('cluster-a');

		expect(result).toMatchObject({ connected: false, error: 'Authorization failed' });
		expect(mocks.updateCluster).toHaveBeenCalledWith('cluster-a', {
			lastError: 'Authorization failed'
		});
	});

	test('sanitizes unexpected failures before returning them', async () => {
		mocks.getClusterKubeconfig.mockRejectedValue(new Error('https://10.0.0.4:6443 failed'));

		const result = await testClusterConnection('cluster-a');

		expect(result).toMatchObject({
			connected: false,
			error: '[sanitized] https://10.0.0.4:6443 failed'
		});
	});
});
