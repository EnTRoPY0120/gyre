import { beforeEach, describe, expect, mock, test } from 'bun:test';
import type { User } from '../lib/server/db/schema.js';

const clusterWideChecks: unknown[][] = [];
const scopedChecks: unknown[][] = [];

let allowClusterWide = true;
let allowScoped = true;

mock.module('$lib/server/rbac.js', () => ({
	checkClusterWideReadPermission: async (...args: unknown[]) => {
		clusterWideChecks.push(args);
		return allowClusterWide;
	},
	checkPermission: async (...args: unknown[]) => {
		scopedChecks.push(args);
		return allowScoped;
	}
}));

mock.module('$lib/server/kubernetes/client.js', () => ({
	listFluxResources: async () => ({ items: [], total: 0, hasMore: false, offset: 0, limit: 50 }),
	createFluxResource: async () => ({ ok: true })
}));

mock.module('$lib/server/kubernetes/errors.js', () => ({
	handleApiError: (err: unknown) => {
		throw err;
	}
}));

mock.module('$lib/server/validation', () => ({
	validateK8sNamespace: () => {},
	validateFluxResourceSpec: () => null
}));

import {
	GET as listGET,
	POST as createPOST
} from '../routes/api/v1/flux/[resourceType]/+server.js';

function createUser(role: User['role'] = 'editor'): User {
	const now = new Date();
	return {
		id: 'user-1',
		username: 'editor',
		email: null,
		name: 'Editor',
		emailVerified: false,
		image: null,
		role,
		active: true,
		isLocal: true,
		requiresPasswordChange: false,
		createdAt: now,
		updatedAt: now,
		preferences: null
	};
}

beforeEach(() => {
	clusterWideChecks.length = 0;
	scopedChecks.length = 0;
	allowClusterWide = true;
	allowScoped = true;
});

describe('flux [resourceType] RBAC boundaries', () => {
	test('GET uses explicit cluster-wide read permission for all-namespace list', async () => {
		allowClusterWide = false;

		await expect(
			listGET({
				params: { resourceType: 'gitrepositories' },
				locals: { user: createUser(), cluster: 'cluster-a' },
				setHeaders: () => {},
				request: new Request('http://localhost/api/v1/flux/gitrepositories'),
				url: new URL('http://localhost/api/v1/flux/gitrepositories')
			} as Parameters<typeof listGET>[0])
		).rejects.toMatchObject({
			status: 403,
			body: { message: 'Permission denied' }
		});

		expect(clusterWideChecks).toHaveLength(1);
		expect(clusterWideChecks[0][1]).toBe('cluster-a');
		expect(scopedChecks).toHaveLength(0);
	});

	test('POST still uses namespace-scoped checkPermission for writes', async () => {
		allowScoped = false;

		await expect(
			createPOST({
				params: { resourceType: 'gitrepositories' },
				locals: { user: createUser(), cluster: 'cluster-a' },
				request: new Request('http://localhost/api/v1/flux/gitrepositories', {
					method: 'POST',
					headers: { 'content-type': 'application/json' },
					body: JSON.stringify({
						apiVersion: 'source.toolkit.fluxcd.io/v1',
						kind: 'GitRepository',
						metadata: { name: 'demo' },
						spec: { interval: '1m' }
					})
				})
			} as Parameters<typeof createPOST>[0])
		).rejects.toMatchObject({
			status: 403,
			body: { message: 'Permission denied' }
		});

		expect(scopedChecks).toHaveLength(1);
		expect(scopedChecks[0][1]).toBe('write');
		expect(scopedChecks[0][2]).toBe('GitRepository');
		expect(scopedChecks[0][3]).toBe('default');
		expect(scopedChecks[0][4]).toBe('cluster-a');
		expect(clusterWideChecks).toHaveLength(0);
	});
});
