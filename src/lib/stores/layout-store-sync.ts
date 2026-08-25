import { IN_CLUSTER_ID, type ClusterOption } from '$lib/clusters/identity.js';
import type { UserPreferences } from '$lib/types/user.js';
import { buildEventStorageScope, type LayoutUserIdentity } from './layout-sync.js';

interface LayoutSyncUser extends LayoutUserIdentity {
	preferences?: Pick<UserPreferences, 'notifications'> | null;
}

export interface LayoutSyncData {
	health: {
		availableClusters?: ClusterOption[];
		currentClusterId?: string;
		error?: string;
	};
	user: LayoutSyncUser | null;
}

export interface LayoutStoreSyncActions {
	setAvailable: (clusters: ClusterOption[]) => void;
	setCurrent: (clusterId: string) => void;
	setError: (message: string | null) => void;
	setNotifications: (preferences: UserPreferences['notifications']) => void;
	setStorageScope: (scope: ReturnType<typeof buildEventStorageScope>) => void;
}

export function syncLayoutStores(data: LayoutSyncData, actions: LayoutStoreSyncActions): void {
	if (data.health.availableClusters) actions.setAvailable(data.health.availableClusters);
	actions.setCurrent(data.health.currentClusterId || IN_CLUSTER_ID);
	actions.setError(data.health.error ?? null);
	actions.setNotifications(data.user?.preferences?.notifications);
	actions.setStorageScope(buildEventStorageScope(data.health.currentClusterId, data.user));
}
