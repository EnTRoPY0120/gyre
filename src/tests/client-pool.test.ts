import { afterEach, beforeEach, expect, test, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ create: vi.fn(), dispose: vi.fn(), config: vi.fn() }));
vi.mock('../lib/server/kubernetes/client-factory.js', () => ({
	makeApiClientWithTimeout: mocks.create,
	disposeKubernetesClient: mocks.dispose,
	destroyHttpAgents: vi.fn(),
	logKubernetesShutdownComplete: vi.fn()
}));
vi.mock('../lib/server/kubernetes/kubeconfig-provider.js', () => ({
	getKubeConfig: mocks.config,
	clearBaseKubeConfig: vi.fn()
}));
import {
	clearClientPool,
	getCoreV1Api,
	getCustomObjectsApi,
	getPoolMetrics
} from '../lib/server/kubernetes/client-pool.js';

beforeEach(() => {
	clearClientPool();
	vi.clearAllMocks();
	mocks.config.mockResolvedValue({});
	mocks.create.mockImplementation(async () => ({}));
});
afterEach(() => {
	clearClientPool();
	vi.useRealTimers();
});

test('deduplicates concurrent creation and isolates clusters, API kinds and timeouts', async () => {
	const clients = await Promise.all(Array.from({ length: 10 }, () => getCoreV1Api('a')));
	expect(new Set(clients).size).toBe(1);
	expect(mocks.create).toHaveBeenCalledTimes(1);
	expect(await getCoreV1Api('b')).not.toBe(clients[0]);
	expect(await getCustomObjectsApi('a')).not.toBe(clients[0]);
	expect(await getCoreV1Api('a', undefined, 999)).not.toBe(clients[0]);
	clearClientPool('a');
	expect(mocks.dispose).toHaveBeenCalledTimes(3);
	expect(getPoolMetrics().poolSizes.coreV1).toBe(1);
	clearClientPool();
	expect(mocks.dispose).toHaveBeenCalledTimes(4);
});

test.each([undefined, 'a'])(
	'clearing %s invalidates pending factories without deleting a newer replacement',
	async (cluster) => {
		let resolve!: (client: object) => void;
		mocks.create.mockImplementationOnce(
			() =>
				new Promise((r) => {
					resolve = r;
				})
		);
		const old = getCoreV1Api('a');
		await vi.waitFor(() => expect(resolve).toBeTypeOf('function'));
		clearClientPool(cluster);
		const newer = await getCoreV1Api('a');
		const stale = {};
		const rejected = expect(old).rejects.toThrow('cleared during client creation');
		resolve(stale);
		await rejected;
		expect(mocks.dispose).toHaveBeenCalledWith(stale);
		expect(await getCoreV1Api('a')).toBe(newer);
	}
);

test('failed factories release pending entries so the next caller can retry', async () => {
	mocks.create.mockRejectedValueOnce(new Error('authentication failed'));
	await expect(getCoreV1Api('a')).rejects.toThrow('authentication failed');
	await expect(getCoreV1Api('a')).resolves.toBeDefined();
	expect(mocks.create).toHaveBeenCalledTimes(2);
});

test('TTL access and periodic cleanup dispose expired clients', async () => {
	vi.useFakeTimers();
	const first = await getCoreV1Api('a');
	await vi.advanceTimersByTimeAsync(5 * 60_000);
	expect(await getCoreV1Api('a')).not.toBe(first);
	expect(mocks.dispose).toHaveBeenCalledWith(first);
	// Capacity enforcement also prunes expired clients across API pools.
	const custom = await getCustomObjectsApi('a');
	await vi.advanceTimersByTimeAsync(5 * 60_000);
	for (let i = 0; i < 51; i++) await getCoreV1Api(`c${i}`);
	expect(mocks.dispose).toHaveBeenCalledWith(custom);
});

test('LRU eviction retires the oldest clients and respects recent access', async () => {
	vi.useFakeTimers();
	const oldest = await getCoreV1Api('oldest');
	await vi.advanceTimersByTimeAsync(1);
	const retained = await getCoreV1Api('retained');
	for (let i = 0; i < 48; i++) {
		await vi.advanceTimersByTimeAsync(1);
		await getCoreV1Api(`c${i}`);
	}
	await vi.advanceTimersByTimeAsync(1);
	await getCoreV1Api('retained');
	await getCoreV1Api('overflow');
	expect(mocks.dispose).toHaveBeenCalledWith(oldest);
	expect(mocks.dispose.mock.calls.some(([client]) => client === retained)).toBe(false);
	expect(getPoolMetrics().poolSizes.coreV1).toBeLessThanOrEqual(50);
});
