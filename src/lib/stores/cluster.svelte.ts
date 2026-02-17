import { browser } from '$app/environment';
import Cookies from 'js-cookie';

/**
 * Cluster Store using Svelte 5's $state
 */
class ClusterStore {
	current = $state<string | undefined>(undefined);
	available = $state<string[]>([]);

	constructor() {
		// Initialize from cookie if in browser
		if (browser) {
			const value = Cookies.get('gyre_cluster');
			if (value) {
				this.current = value;
			}
		}
	}

	setCluster(name: string) {
		this.current = name;
		if (browser) {
			Cookies.set('gyre_cluster', name, { expires: 30, path: '/' });
			// Reload to refresh all data from the new cluster
			window.location.reload();
		}
	}

	setAvailable(clusters: string[]) {
		this.available = clusters;
	}
}

export const clusterStore = new ClusterStore();
