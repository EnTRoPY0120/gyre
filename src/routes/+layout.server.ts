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

type LayoutHealth = {
	connected: boolean;
	currentClusterId: string;
	currentClusterName: string;
	availableClusters: ClusterOption[];
	error?: string;
};

function getHealthErrorMessage(error: unknown): string {
	if (isHttpErrorLike(error)) {
		return 'Failed to retrieve cluster health status';
	}

	return error instanceof Error ? error.message : 'Failed to connect to cluster API';
}

function markSelectedClusterConnected(
	clusters: ClusterOption[],
	selectedClusterId: string,
	connected: boolean
): ClusterOption[] {
	return clusters.map((cluster) => ({
		...cluster,
		connected: cluster.id === selectedClusterId ? connected : false
	}));
}

function markClustersDisconnected(clusters: ClusterOption[]): ClusterOption[] {
	return clusters.map((cluster) => ({ ...cluster, connected: false }));
}

function createHealth(
	selectedClusterId: string,
	availableClusters: ClusterOption[],
	connected: boolean,
	error?: string
): LayoutHealth {
	const selectedCluster = availableClusters.find((cluster) => cluster.id === selectedClusterId);
	return {
		connected,
		currentClusterId: selectedClusterId,
		currentClusterName: selectedCluster?.name ?? selectedClusterId,
		availableClusters,
		error
	};
}

async function getFallbackClusters(currentContext: string | null): Promise<ClusterOption[]> {
	try {
		return markClustersDisconnected(await getSelectableClusters(currentContext));
	} catch {
		return [];
	}
}

async function loadClusterHealth(
	locals: App.Locals,
	selectedClusterId: string
): Promise<LayoutHealth> {
	let currentContext: string | null = null;

	try {
		const healthData = await getFluxHealthSummary({
			locals,
			includeDetails: Boolean(locals.user)
		});
		currentContext = healthData.kubernetes?.currentContext ?? null;
		const connected = healthData.kubernetes?.connected ?? healthData.status === 'healthy';
		const availableClusters = markSelectedClusterConnected(
			await getSelectableClusters(currentContext),
			selectedClusterId,
			connected
		);
		return createHealth(selectedClusterId, availableClusters, connected);
	} catch (error) {
		const availableClusters = await getFallbackClusters(currentContext);
		return createHealth(selectedClusterId, availableClusters, false, getHealthErrorMessage(error));
	}
}

async function loadFluxVersion(locals: App.Locals): Promise<string> {
	if (locals.user) {
		try {
			await requireClusterWideRead(locals);
			return (await getFluxInstalledVersion({ locals })).version;
		} catch {
			return DEFAULT_FLUX_VERSION;
		}
	}

	return DEFAULT_FLUX_VERSION;
}

export const load: LayoutServerLoad = async ({ locals, depends }) => {
	depends('gyre:layout');

	const selectedClusterId = locals.cluster ?? IN_CLUSTER_ID;
	const health = await loadClusterHealth(locals, selectedClusterId);
	const fluxVersion = await loadFluxVersion(locals);

	return {
		health,
		fluxVersion,
		gyreVersion: pkg.version,
		user: serializeUser(locals.user)
	};
};
