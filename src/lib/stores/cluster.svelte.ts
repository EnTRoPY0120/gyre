import { browser } from '$app/environment';
import Cookies from 'js-cookie';

/**
 * Cluster Store using Svelte 5's $state
 */
class ClusterStore {
	current = $state<string | undefined>(undefined);
	available = $state<string[]>([]);
	loaded = $state<boolean>(false);
	error = $state<string | null>(null);

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
			Cookies.set('gyre_cluster', name, {
				expires: 30,
				path: '/',
				secure: true,
				sameSite: 'Lax'
			});
			// Reload to refresh all data from the new cluster
			window.location.reload();
		}
	}

	setAvailable(clusters: string[]) {
		this.available = clusters;
		this.loaded = true;
		this.error = null;
	}

	setError(message: string) {
		this.error = message;
		this.loaded = true;
		this.available = [];
	}

	resetLoading() {
		this.loaded = false;
		this.error = null;
	}
}

export const clusterStore = new ClusterStore();
