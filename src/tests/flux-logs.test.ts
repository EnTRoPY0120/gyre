import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
	getCoreV1Api: vi.fn(),
	handleK8sError: vi.fn((error: unknown) => error)
}));

vi.mock('../lib/server/kubernetes/client-pool.js', () => ({ getCoreV1Api: mocks.getCoreV1Api }));
vi.mock('../lib/server/kubernetes/error-handler.js', () => ({
	handleK8sError: mocks.handleK8sError
}));

import { getControllerLogs } from '../lib/server/kubernetes/flux/logs.js';

beforeEach(() => {
	vi.clearAllMocks();
});

afterEach(() => vi.restoreAllMocks());

describe('getControllerLogs', () => {
	test('selects a running controller pod and filters matching lines', async () => {
		const coreApi = {
			listNamespacedPod: vi.fn().mockResolvedValue({
				items: [
					{ metadata: { name: 'pending' }, status: { phase: 'Pending' } },
					{ metadata: { name: 'running' }, status: { phase: 'Running' } }
				]
			}),
			readNamespacedPodLog: vi
				.fn()
				.mockResolvedValue('irrelevant\n{"name":"app","namespace":"flux-system"}\n')
		};
		mocks.getCoreV1Api.mockResolvedValue(coreApi);

		await expect(getControllerLogs('GitRepository', 'flux-system', 'app')).resolves.toBe(
			'{"name":"app","namespace":"flux-system"}'
		);
		expect(coreApi.readNamespacedPodLog).toHaveBeenCalledWith({
			name: 'running',
			namespace: 'flux-system',
			tailLines: 1000
		});
	});

	test('falls back to the app.kubernetes.io/name selector', async () => {
		const listNamespacedPod = vi
			.fn()
			.mockResolvedValueOnce({ items: [] })
			.mockResolvedValueOnce({ items: [{ metadata: { name: 'fallback' } }] });
		const coreApi = {
			listNamespacedPod,
			readNamespacedPodLog: vi.fn().mockResolvedValue('')
		};
		mocks.getCoreV1Api.mockResolvedValue(coreApi);

		await expect(getControllerLogs('helmreleases', 'flux-system', 'app')).resolves.toContain(
			'No controller log lines matched'
		);
		expect(listNamespacedPod).toHaveBeenNthCalledWith(2, {
			namespace: 'flux-system',
			labelSelector: 'app.kubernetes.io/name=helm-controller'
		});
	});

	test('maps controller lookup failures through the Kubernetes error handler', async () => {
		const failure = new Error('no pods');
		mocks.getCoreV1Api.mockResolvedValue({
			listNamespacedPod: vi.fn().mockRejectedValue(failure)
		});

		await expect(getControllerLogs('GitRepository', 'flux-system', 'app')).rejects.toBe(failure);
		expect(mocks.handleK8sError).toHaveBeenCalledWith(
			failure,
			'fetch logs for source-controller',
			expect.any(Number)
		);
	});

	test('rejects unknown resource types before contacting Kubernetes', async () => {
		await expect(getControllerLogs('unknown-resource', 'flux-system', 'app')).rejects.toThrow(
			'Unknown resource type: unknown-resource'
		);
		expect(mocks.getCoreV1Api).not.toHaveBeenCalled();
	});
});
