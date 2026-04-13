import type { LayoutServerLoad } from './$types';
import pkg from '../../package.json';
import { serializeUser } from '$lib/server/auth';
import {
	DEFAULT_FLUX_VERSION,
	getFluxHealthSummary,
	getFluxInstalledVersion
} from '$lib/server/flux/services.js';
import { requireClusterWideRead } from '$lib/server/http/guards.js';

function isHttpErrorLike(error: unknown): error is { status: number } {
	return (
		typeof error === 'object' &&
		error !== null &&
		'status' in error &&
		typeof (error as { status: unknown }).status === 'number'
	);
}

export const load: LayoutServerLoad = async ({ locals, depends }) => {
	depends('gyre:layout');

	let health = {
		connected: false,
		clusterName: undefined as string | undefined,
		availableClusters: [] as string[],
		error: undefined as string | undefined
	};

	try {
		const healthData = await getFluxHealthSummary({
			locals,
			includeDetails: Boolean(locals.user)
		});

		health = {
			connected: healthData.kubernetes?.connected ?? false,
			clusterName: healthData.kubernetes?.currentContext ?? undefined,
			availableClusters: healthData.kubernetes?.availableContexts ?? [],
			error: undefined
		};
	} catch (error) {
		health = {
			connected: false,
			clusterName: undefined,
			availableClusters: [],
			error: isHttpErrorLike(error)
				? 'Failed to retrieve cluster health status'
				: error instanceof Error
					? error.message
					: 'Failed to connect to cluster API'
		};
	}

	let fluxVersion = DEFAULT_FLUX_VERSION;
	if (locals.user) {
		try {
			await requireClusterWideRead(locals);
			fluxVersion = (await getFluxInstalledVersion({ locals })).version;
		} catch {
			fluxVersion = DEFAULT_FLUX_VERSION;
		}
	}

	return {
		health,
		fluxVersion,
		gyreVersion: pkg.version,
		user: serializeUser(locals.user)
	};
};
