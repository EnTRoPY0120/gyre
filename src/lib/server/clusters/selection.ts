import { IN_CLUSTER_ID, normalizeClusterId, type ClusterOption } from '$lib/clusters/identity.js';
import { getClusterById, getSelectableClusters } from './repository.js';
import type { Cookies } from '@sveltejs/kit';

export const CLUSTER_SELECTION_COOKIE = 'gyre_cluster';

const COOKIE_OPTIONS = {
	path: '/',
	httpOnly: true,
	sameSite: 'lax' as const,
	secure: process.env.NODE_ENV === 'production',
	maxAge: 60 * 60 * 24 * 30
};

export async function validateSelectableClusterId(clusterId: string): Promise<string> {
	const normalizedId = normalizeClusterId(clusterId);
	if (normalizedId === IN_CLUSTER_ID) return IN_CLUSTER_ID;

	const cluster = await getClusterById(normalizedId);
	if (!cluster || !cluster.isActive) {
		throw new Error(`Cluster "${normalizedId}" is not selectable`);
	}

	return normalizedId;
}

export async function resolveClusterSelectionFromCookie(cookies: Cookies): Promise<string> {
	const cookieValue = cookies.get(CLUSTER_SELECTION_COOKIE);
	if (!cookieValue) return IN_CLUSTER_ID;

	try {
		return await validateSelectableClusterId(cookieValue);
	} catch {
		clearClusterSelectionCookie(cookies);
		return IN_CLUSTER_ID;
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
	const selectableClusters = await getSelectableClusters();
	const currentCluster =
		selectableClusters.find((cluster) => cluster.id === currentClusterId) ?? selectableClusters[0];

	return {
		currentCluster,
		currentClusterId: currentCluster.id,
		selectableClusters
	};
}
