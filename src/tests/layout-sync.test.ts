import { describe, expect, test } from 'vitest';
import { buildEventStorageScope, hasEventConnectionChanged } from '../lib/stores/layout-sync.js';

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
});
