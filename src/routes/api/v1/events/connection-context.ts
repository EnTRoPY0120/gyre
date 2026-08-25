import { IN_CLUSTER_ID } from '$lib/clusters/identity.js';

export interface EventConnectionContext {
	clusterId: string;
	sessionId: string;
	userId: string;
}

export function getEventConnectionContext(
	userId: string | number,
	clusterId: string | undefined,
	sessionId: string | undefined,
	getClientAddress: () => string
): EventConnectionContext {
	return {
		clusterId: clusterId ?? IN_CLUSTER_ID,
		sessionId: sessionId ?? getClientAddress(),
		userId: String(userId)
	};
}
