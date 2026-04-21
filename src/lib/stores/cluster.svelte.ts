import { invalidate } from '$app/navigation';
import { IN_CLUSTER_ID, normalizeClusterId, type ClusterOption } from '$lib/clusters/identity.js';

/**
 * Cluster Store using Svelte 5's $state
 */
class ClusterStore {
	current = $state<string>(IN_CLUSTER_ID);
	available = $state<ClusterOption[]>([]);
	loaded = $state<boolean>(false);
	error = $state<string | null>(null);

	async setCluster(id: string) {
		const previousId = this.current;
		const requestedId = normalizeClusterId(id);
		this.current = requestedId;
		this.error = null;

		try {
			const response = await fetch('/api/v1/user/cluster', {
				method: 'PUT',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ clusterId: requestedId })
			});

			if (!response.ok) {
				throw new Error('Failed to switch cluster');
			}

			const payload = (await response.json()) as {
				currentClusterId?: string;
				currentCluster?: ClusterOption;
				selectableClusters?: ClusterOption[];
			};
			this.current = normalizeClusterId(payload.currentClusterId ?? payload.currentCluster?.id);
			if (payload.selectableClusters) {
				this.setAvailable(payload.selectableClusters);
			}
			await invalidate('gyre:layout');
		} catch (error) {
			this.current = previousId;
			this.error = error instanceof Error ? error.message : 'Failed to switch cluster';
			throw error;
		}
	}

	setCurrent(id: string) {
		this.current = normalizeClusterId(id);
	}

	setAvailable(clusters: ClusterOption[]) {
		this.available = clusters;
		this.loaded = true;
	}

	setError(message: string | null) {
		this.error = message;
	}
}

export const clusterStore = new ClusterStore();
