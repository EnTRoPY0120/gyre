import { IN_CLUSTER_ID, normalizeClusterId, type ClusterOption } from '$lib/clusters/identity.js';
import { getClusterById, getSelectableClusters } from './repository.js';
import {
	getDefaultLocalKubeconfigContext,
	hasLocalKubeconfigContext,
	shouldUseLocalKubeconfigContexts
} from './local-kubeconfig.js';
import type { Cookies } from '@sveltejs/kit';

export const CLUSTER_SELECTION_COOKIE = 'gyre_cluster';

const COOKIE_OPTIONS = {
	path: '/',
	httpOnly: true,
	sameSite: 'lax' as const,
	secure: process.env.NODE_ENV === 'production',
	maxAge: 60 * 60 * 24 * 30
};

export function getDefaultClusterSelection(): string {
	return getDefaultLocalKubeconfigContext() ?? IN_CLUSTER_ID;
}

export async function validateSelectableClusterId(clusterId: string): Promise<string> {
	const normalizedId = normalizeClusterId(clusterId);
	if (normalizedId === IN_CLUSTER_ID) {
		return shouldUseLocalKubeconfigContexts() ? getDefaultClusterSelection() : IN_CLUSTER_ID;
	}

	if (hasLocalKubeconfigContext(normalizedId)) {
		return normalizedId;
	}

	const cluster = await getClusterById(normalizedId);
	if (!cluster || !cluster.isActive) {
		throw new Error(`Cluster "${normalizedId}" is not selectable`);
	}

	return normalizedId;
}

export async function resolveClusterSelectionFromCookie(cookies: Cookies): Promise<string> {
	const cookieValue = cookies.get(CLUSTER_SELECTION_COOKIE);
	if (!cookieValue) return getDefaultClusterSelection();

	try {
		return await validateSelectableClusterId(cookieValue);
	} catch {
		clearClusterSelectionCookie(cookies);
		return getDefaultClusterSelection();
	}
}

export function setClusterSelectionCookie(cookies: Cookies, clusterId: string): void {
	const normalizedId = normalizeClusterId(clusterId);
	cookies.set(CLUSTER_SELECTION_COOKIE, normalizedId, COOKIE_OPTIONS);
}

export function clearClusterSelectionCookie(cookies: Cookies): void {
	cookies.delete(CLUSTER_SELECTION_COOKIE, { path: '/' });
}

export async function getClusterSelectionPayload(currentClusterId: string): Promise<{
	currentCluster: ClusterOption;
	currentClusterId: string;
	selectableClusters: ClusterOption[];
}> {
	const normalizedCurrentClusterId = await validateSelectableClusterId(currentClusterId).catch(() =>
		getDefaultClusterSelection()
	);
	const selectableClusters = await getSelectableClusters(normalizedCurrentClusterId);
	const currentCluster =
		selectableClusters.find((cluster) => cluster.id === normalizedCurrentClusterId) ??
		selectableClusters[0];

	return {
		currentCluster,
		currentClusterId: currentCluster.id,
		selectableClusters
	};
}
