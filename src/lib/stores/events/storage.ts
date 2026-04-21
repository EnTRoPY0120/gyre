import { normalizeClusterId } from '$lib/clusters/identity.js';

export function hashStorageUserIdentity(value: string): string {
	let hash = 0xcbf29ce484222325n;
	for (const byte of new TextEncoder().encode(value)) {
		hash ^= BigInt(byte);
		hash = BigInt.asUintN(64, hash * 0x100000001b3n);
	}
	return hash.toString(16).padStart(16, '0');
}

export function getNotificationStorageKeys(clusterId: string, userIdentity: string | null) {
	const normalizedClusterId = normalizeClusterId(clusterId);
	const userScope = userIdentity ? hashStorageUserIdentity(userIdentity) : 'anonymous';
	return {
		notifications: `gyre_notifications_${normalizedClusterId}_${userScope}`,
		state: `gyre_notification_state_${normalizedClusterId}_${userScope}`
	};
}
