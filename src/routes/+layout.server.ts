import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async ({ fetch }) => {
	try {
		const response = await fetch('/api/flux/health');
		if (response.ok) {
			const health = await response.json();
			return {
				health: {
					connected: health.connected ?? false,
					clusterName: health.clusterName ?? undefined
				}
			};
		}
	} catch {
		// Ignore errors and return disconnected status
	}

	return {
		health: {
			connected: false,
			clusterName: undefined
		}
	};
};
