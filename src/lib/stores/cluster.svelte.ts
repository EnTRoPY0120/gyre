import { browser } from '$app/environment';
import { IN_CLUSTER_ID, normalizeClusterId, type ClusterOption } from '$lib/clusters/identity.js';
import Cookies from 'js-cookie';

/**
 * Cluster Store using Svelte 5's $state
 */
class ClusterStore {
	current = $state<string>(IN_CLUSTER_ID);
	available = $state<ClusterOption[]>([]);
	loaded = $state<boolean>(false);
	error = $state<string | null>(null);

	constructor() {
		// Initialize from cookie if in browser
		if (browser) {
			const value = Cookies.get('gyre_cluster');
			this.current = normalizeClusterId(value);
		}
	}

	setCluster(id: string) {
		const normalizedId = normalizeClusterId(id);
		this.current = normalizedId;
		if (browser) {
			Cookies.set('gyre_cluster', normalizedId, {
				expires: 30,
				path: '/',
				secure: true,
				sameSite: 'Lax'
			});
			// Reload to refresh all data from the new cluster
			window.location.reload();
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
