import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async ({ fetch, locals }) => {
	try {
		const [healthRes, versionRes] = await Promise.all([
			fetch('/api/flux/health'),
			fetch('/api/flux/version')
		]);

		const healthData = healthRes.ok ? await healthRes.json() : null;
		const versionData = versionRes.ok ? await versionRes.json() : { version: 'v2.x.x' };

		return {
			health: {
				connected: healthData?.kubernetes?.connected ?? false,
				clusterName: healthData?.kubernetes?.currentContext ?? undefined,
				availableClusters: healthData?.kubernetes?.availableContexts ?? []
			},
			fluxVersion: versionData.version,
			user: locals.user
				? {
						username: locals.user.username,
						role: locals.user.role,
						email: locals.user.email
					}
				: null
		};
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
