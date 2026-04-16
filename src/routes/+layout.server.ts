import type { LayoutServerLoad } from './$types';
import pkg from '../../package.json';
import { IN_CLUSTER_ID, type ClusterOption } from '$lib/clusters/identity.js';
import { serializeUser } from '$lib/server/auth';
import { getSelectableClusters } from '$lib/server/clusters.js';
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

	const selectedClusterId = locals.cluster ?? IN_CLUSTER_ID;
	let health: {
		connected: boolean;
		currentClusterId: string;
		currentClusterName: string;
		availableClusters: ClusterOption[];
		error?: string;
	};
	let currentContext: string | null = null;
	let availableClusters: ClusterOption[] = [];

	try {
		const healthData = await getFluxHealthSummary({
			locals,
			includeDetails: Boolean(locals.user)
		});
		currentContext = healthData.kubernetes?.currentContext ?? null;
		availableClusters = await getSelectableClusters(selectedClusterId, currentContext);
		const connected = healthData.kubernetes?.connected ?? healthData.status === 'healthy';
		availableClusters = availableClusters.map((cluster) => ({
			...cluster,
			connected: cluster.id === selectedClusterId ? connected : cluster.connected
		}));
		const selectedCluster = availableClusters.find((cluster) => cluster.id === selectedClusterId);

		health = {
			connected,
			currentClusterId: selectedClusterId,
			currentClusterName: selectedCluster?.name ?? selectedClusterId,
			availableClusters,
			error: undefined
		};
	} catch (error) {
		try {
			availableClusters = await getSelectableClusters(selectedClusterId, currentContext);
		} catch {
			availableClusters = [];
		}
		const selectedCluster = availableClusters.find((cluster) => cluster.id === selectedClusterId);
		health = {
			connected: false,
			currentClusterId: selectedClusterId,
			currentClusterName: selectedCluster?.name ?? selectedClusterId,
			availableClusters,
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
