import type { Handle } from '@sveltejs/kit';
import { getKubeConfig } from '$lib/server/kubernetes/client';

/**
 * Handle function to manage cluster context via cookies
 */
export const handle: Handle = async ({ event, resolve }) => {
	const cluster = event.cookies.get('gyre_cluster');

	if (cluster) {
		event.locals.cluster = cluster;
	} else {
		// Fallback to default context from kubeconfig
		try {
			const { currentContext } = getKubeConfig();
			event.locals.cluster = currentContext;

			// Optionally set the cookie if it's missing so the UI is in sync
			if (currentContext) {
				event.cookies.set('gyre_cluster', currentContext, {
					path: '/',
					httpOnly: false, // Accessible by client-side JS
					maxAge: 60 * 60 * 24 * 30 // 30 days
				});
			}
		} catch (err) {
			console.warn('Failed to load default kubeconfig in hooks:', err);
		}
	}

	return resolve(event);
};
