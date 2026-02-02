import { browser } from '$app/environment';

/**
 * Cluster Store using Svelte 5's $state
 */
class ClusterStore {
	current = $state<string | undefined>(undefined);
	available = $state<string[]>([]);

	constructor() {
		// Initialize from cookie if in browser
		if (browser) {
			const match = document.cookie.match(/gyre_cluster=([^;]+)/);
			if (match) {
				this.current = match[1];
			}
		}
	}

	setCluster(name: string) {
		this.current = name;
		if (browser) {
			document.cookie = `gyre_cluster=${name}; path=/; max-age=${60 * 60 * 24 * 30}`;
			// Reload to refresh all data from the new cluster
			window.location.reload();
		}
	}

	setAvailable(clusters: string[]) {
		this.available = clusters;
	}
}

export const clusterStore = new ClusterStore();
