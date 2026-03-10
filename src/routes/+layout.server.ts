import type { LayoutServerLoad } from './$types';
import pkg from '../../package.json';
import { serializeUser } from '$lib/server/auth';
import { fetchWithRetry } from '$lib/utils/fetch';

const DEFAULT_FLUX_VERSION = 'v2.x.x';

export const load: LayoutServerLoad = async ({ fetch: svelteFetch, locals, depends }) => {
	depends('gyre:layout');
	try {
		const [healthRes, versionRes] = await Promise.all([
			fetchWithRetry('/api/flux/health', undefined, { fetchFn: svelteFetch, maxRetries: 0 }),
			fetchWithRetry('/api/flux/version', undefined, { fetchFn: svelteFetch, maxRetries: 0 })
		]);

		const healthData = healthRes.ok ? await healthRes.json() : null;
		const versionData = versionRes.ok ? await versionRes.json() : { version: DEFAULT_FLUX_VERSION };

		return {
			health: {
				connected: healthData?.kubernetes?.connected ?? false,
				clusterName: healthData?.kubernetes?.currentContext ?? undefined,
				availableClusters: healthData?.kubernetes?.availableContexts ?? [],
				error: healthRes.ok ? undefined : 'Failed to retrieve cluster health status'
			},
			fluxVersion: versionData.version,
			gyreVersion: pkg.version,
			user: serializeUser(locals.user)
		};
	} catch (error) {
		// Surface cluster connection error in health.error side-channel
		return {
			health: {
				connected: false,
				clusterName: undefined,
				availableClusters: [],
				error: error instanceof Error ? error.message : 'Failed to connect to cluster API'
			},
			fluxVersion: DEFAULT_FLUX_VERSION,
			gyreVersion: pkg.version,
			user: serializeUser(locals.user)
		};
	}
};
