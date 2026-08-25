import type { ClusterOption } from '$lib/clusters/identity';

export interface ClusterSwitchResponse {
	currentClusterId?: string;
	currentCluster?: ClusterOption;
	selectableClusters?: ClusterOption[];
}

/** Request a cluster switch and return the server's selected-cluster payload. */
export async function requestClusterSwitch(
	clusterId: string,
	fetcher: typeof fetch = fetch
): Promise<ClusterSwitchResponse> {
	const response = await fetcher('/api/v1/user/cluster', {
		method: 'PUT',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ clusterId })
	});

	if (!response.ok) {
		throw new Error('Failed to switch cluster');
	}

	return (await response.json()) as ClusterSwitchResponse;
}
