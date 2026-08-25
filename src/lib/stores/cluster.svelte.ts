import { invalidate } from '$app/navigation';
import { IN_CLUSTER_ID, normalizeClusterId, type ClusterOption } from '$lib/clusters/identity.js';
import { requestClusterSwitch } from './cluster-requests';

/**
 * Cluster Store using Svelte 5's $state
 */
class ClusterStore {
	current = $state<string>(IN_CLUSTER_ID);
	available = $state<ClusterOption[]>([]);
	loaded = $state<boolean>(false);
	error = $state<string | null>(null);

	private applySwitchResponse(payload: Awaited<ReturnType<typeof requestClusterSwitch>>): void {
		this.current = normalizeClusterId(payload.currentClusterId ?? payload.currentCluster?.id);
		if (payload.selectableClusters) {
			this.setAvailable(payload.selectableClusters);
		}
	}

	async setCluster(id: string) {
		const previousId = this.current;
		const requestedId = normalizeClusterId(id);
		this.current = requestedId;
		this.error = null;

		try {
			const payload = await requestClusterSwitch(requestedId);
			this.applySwitchResponse(payload);
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
