import { describe, expect, test, vi } from 'vitest';
import { requestClusterSwitch } from '../lib/stores/cluster-requests.js';

describe('requestClusterSwitch', () => {
	test('sends the requested cluster ID and returns the response payload', async () => {
		const payload = { currentClusterId: 'cluster-a', selectableClusters: [] };
		const fetcher = vi
			.fn<typeof fetch>()
			.mockResolvedValue(new Response(JSON.stringify(payload), { status: 200 }));

		await expect(requestClusterSwitch('cluster-a', fetcher)).resolves.toEqual(payload);
		expect(fetcher).toHaveBeenCalledWith('/api/v1/user/cluster', {
			method: 'PUT',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ clusterId: 'cluster-a' })
		});
	});

	test('rejects an unsuccessful response', async () => {
		const fetcher = vi
			.fn<typeof fetch>()
			.mockResolvedValue(new Response(null, { status: 500, statusText: 'Server Error' }));

		await expect(requestClusterSwitch('cluster-a', fetcher)).rejects.toThrow(
			'Failed to switch cluster'
		);
	});
});
