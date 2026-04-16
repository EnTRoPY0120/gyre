import { afterEach, beforeEach, describe, expect, mock, test } from 'bun:test';
import type { User } from '../lib/server/db/schema.js';
import { importFresh } from './helpers/import-fresh';

type FluxListRouteModule = typeof import('../routes/api/v1/flux/[resourceType]/+server.js');

const clusterWideChecks: unknown[][] = [];
const scopedChecks: unknown[][] = [];

let allowClusterWide = true;
let allowScoped = true;
let listGET: FluxListRouteModule['GET'];
let createPOST: FluxListRouteModule['POST'];

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

beforeEach(async () => {
	clusterWideChecks.length = 0;
	scopedChecks.length = 0;
	allowClusterWide = true;
	allowScoped = true;

	mock.module('$lib/server/http/guards.js', () => ({
		requireAuthenticatedUser: () => {},
		requireClusterContext: (locals: App.Locals) => locals.cluster ?? 'cluster-a',
		requireClusterWideRead: async (locals: App.Locals) => {
			clusterWideChecks.push([locals.user, locals.cluster]);
			if (!allowClusterWide) {
				throw { status: 403, body: { message: 'Permission denied' } };
			}
		},
		requireScopedPermission: async (
			locals: App.Locals,
			action: string,
			resourceType: string,
			namespace?: string
		) => {
			scopedChecks.push([locals.user, action, resourceType, namespace, locals.cluster]);
			if (!allowScoped) {
				throw { status: 403, body: { message: 'Permission denied' } };
			}
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

	const routeModule = await importFresh<FluxListRouteModule>(
		'../routes/api/v1/flux/[resourceType]/+server.js'
	);
	listGET = routeModule.GET;
	createPOST = routeModule.POST;
});

afterEach(() => {
	mock.restore();
});

describe('flux [resourceType] RBAC boundaries', () => {
	test('GET uses explicit cluster-wide read permission for all-namespace list', async () => {
		allowClusterWide = false;
		const locals = { user: createUser(), cluster: 'cluster-a' };

		await expect(
			listGET({
				params: { resourceType: 'gitrepositories' },
				locals,
				setHeaders: () => {},
				request: new Request('http://localhost/api/v1/flux/gitrepositories'),
				url: new URL('http://localhost/api/v1/flux/gitrepositories')
			} as Parameters<FluxListRouteModule['GET']>[0])
		).rejects.toMatchObject({
			status: 403,
			body: { message: 'Permission denied' }
		});

		expect(clusterWideChecks).toEqual([[locals.user, 'cluster-a']]);
		expect(scopedChecks).toEqual([]);
	});

	test('POST still uses namespace-scoped checkPermission for writes', async () => {
		allowScoped = false;
		const locals = { user: createUser(), cluster: 'cluster-a' };

		await expect(
			createPOST({
				params: { resourceType: 'gitrepositories' },
				locals,
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
			} as Parameters<FluxListRouteModule['POST']>[0])
		).rejects.toMatchObject({
			status: 403,
			body: { message: 'Permission denied' }
		});

		expect(scopedChecks).toEqual([[locals.user, 'write', 'GitRepository', 'default', 'cluster-a']]);
		expect(clusterWideChecks).toEqual([]);
	});
});
