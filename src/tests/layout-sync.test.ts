import { describe, expect, test } from 'vitest';
import { buildEventStorageScope, hasEventConnectionChanged } from '../lib/stores/layout-sync.js';
import { syncLayoutStores } from '../lib/stores/layout-store-sync.js';

describe('layout synchronization decisions', () => {
	test('scopes notification storage by cluster and authenticated user identity', () => {
		expect(
			buildEventStorageScope('cluster-a', {
				id: 'user-1',
				role: 'admin',
				username: 'admin'
			})
		).toEqual({
			clusterId: 'cluster-a',
			userIdentity: '{"id":"user-1","role":"admin","username":"admin"}'
		});
	});

	test('clears the user scope when layout data has no authenticated user', () => {
		expect(buildEventStorageScope(null, null)).toEqual({
			clusterId: 'in-cluster',
			userIdentity: null
		});
	});

	test('reconnects only when connection health or cluster identity changes', () => {
		expect(hasEventConnectionChanged(true, 'cluster-a', true, 'cluster-a')).toBe(false);
		expect(hasEventConnectionChanged(false, 'cluster-a', true, 'cluster-a')).toBe(true);
		expect(hasEventConnectionChanged(true, 'cluster-b', true, 'cluster-a')).toBe(true);
	});

	test('synchronizes layout stores from health and user data', () => {
		const calls: string[] = [];
		syncLayoutStores(
			{
				health: {
					availableClusters: [{ id: 'cluster-a', name: 'A', connected: true }],
					currentClusterId: 'cluster-a',
					error: 'warning'
				},
				user: {
					id: 'user-1',
					role: 'admin',
					username: 'admin',
					preferences: { notifications: { enabled: false } }
				}
			},
			{
				setAvailable: (clusters) => calls.push(`clusters:${clusters.length}`),
				setCurrent: (clusterId) => calls.push(`current:${clusterId}`),
				setError: (message) => calls.push(`error:${message}`),
				setNotifications: (preferences) => calls.push(`notifications:${preferences?.enabled}`),
				setStorageScope: (scope) => calls.push(`scope:${scope.clusterId}:${scope.userIdentity}`)
			}
		);

		expect(calls).toEqual([
			'clusters:1',
			'current:cluster-a',
			'error:warning',
			'notifications:false',
			'scope:cluster-a:{"id":"user-1","role":"admin","username":"admin"}'
		]);
	});
});
