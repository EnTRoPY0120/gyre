import { IN_CLUSTER_ID } from '$lib/clusters/identity.js';

export interface LayoutUserIdentity {
	id: string;
	role: string;
	username: string;
}

export function buildEventStorageScope(
	clusterId: string | null | undefined,
	user: LayoutUserIdentity | null | undefined
): { clusterId: string; userIdentity: string | null } {
	return {
		clusterId: clusterId || IN_CLUSTER_ID,
		userIdentity: user
			? JSON.stringify({ id: user.id, role: user.role, username: user.username })
			: null
	};
}

export function hasEventConnectionChanged(
	connected: boolean,
	clusterId: string,
	previousConnected: boolean,
	previousClusterId: string
): boolean {
	return connected !== previousConnected || clusterId !== previousClusterId;
}
