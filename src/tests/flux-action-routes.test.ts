import { beforeEach, describe, expect, mock, test } from 'bun:test';
import type { User } from '../lib/server/db/schema.js';

const capturedPermissionChecks: unknown[][] = [];
const capturedReconcileCalls: unknown[][] = [];
const capturedToggleSuspendCalls: unknown[][] = [];
const capturedLogWrites: unknown[][] = [];

let permissionAllowed = true;

class MockRbacError extends Error {
	status = 403;
	body: { message: string; code: string };

	constructor(
		message: string,
		public action: string,
		public resourceType?: string
	) {
		super(message);
		this.name = 'RbacError';
		this.body = {
			message,
			code: 'Forbidden'
		};
	}
}

mock.module('$lib/server/rbac.js', () => ({
	checkPermission: async (...args: unknown[]) => {
		capturedPermissionChecks.push(args);
		return permissionAllowed;
	},
	checkClusterWideReadPermission: async () => permissionAllowed,
	requirePermission: async (...args: unknown[]) => {
		capturedPermissionChecks.push(args);
		if (!permissionAllowed) {
			const action = String(args[1] ?? 'read');
			const resourceType = typeof args[2] === 'string' ? args[2] : undefined;
			throw new MockRbacError(
				`Permission denied: ${action} on ${resourceType || 'resource'}`,
				action,
				resourceType
			);
		}
	},
	isAdmin: (user: { role?: string } | null | undefined) => user?.role === 'admin',
	isValidNamespacePattern: () => true,
	RbacError: MockRbacError
}));

mock.module('$lib/server/kubernetes/flux/actions', () => ({
	reconcileResource: async (...args: unknown[]) => {
		capturedReconcileCalls.push(args);
	},
	toggleSuspendResource: async (...args: unknown[]) => {
		capturedToggleSuspendCalls.push(args);
	}
}));

mock.module('$lib/server/audit.js', () => ({
	logResourceWrite: async (...args: unknown[]) => {
		capturedLogWrites.push(args);
	},
	logAudit: async () => {},
	logLogin: async () => {}
}));

mock.module('$lib/server/audit', () => ({
	logResourceWrite: async (...args: unknown[]) => {
		capturedLogWrites.push(args);
	},
	logAudit: async () => {},
	logLogin: async () => {}
}));

mock.module('$lib/server/kubernetes/errors.js', () => ({
	handleApiError: (err: unknown) => {
		throw err;
	},
	sanitizeK8sErrorMessage: (message: string) => message
}));

mock.module('$lib/server/validation', () => ({
	validateK8sNamespace: () => {},
	validateK8sName: () => {}
}));

mock.module('$lib/server/kubernetes/flux/reconciliation-tracker', () => ({
	captureReconciliation: async () => {}
}));

const { POST: reconcilePOST } =
	(await import('../routes/api/v1/flux/[type]/[namespace]/[name]/reconcile/+server.js?test=flux-action-routes')) as typeof import('../routes/api/v1/flux/[type]/[namespace]/[name]/reconcile/+server.js');
const { POST: resumePOST } =
	(await import('../routes/api/v1/flux/[type]/[namespace]/[name]/resume/+server.js?test=flux-action-routes')) as typeof import('../routes/api/v1/flux/[type]/[namespace]/[name]/resume/+server.js');
const { POST: suspendPOST } =
	(await import('../routes/api/v1/flux/[type]/[namespace]/[name]/suspend/+server.js?test=flux-action-routes')) as typeof import('../routes/api/v1/flux/[type]/[namespace]/[name]/suspend/+server.js');

mock.restore();

function createUser(role: User['role'] = 'editor'): User {
	const now = new Date();
	return {
		id: 'user-1',
		username: 'editor',
		email: null,
		name: 'editor',
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

function buildEvent(type: string) {
	return {
		params: {
			type,
			namespace: 'flux-system',
			name: 'demo'
		},
		locals: {
			user: createUser(),
			cluster: 'in-cluster'
		},
		getClientAddress: () => '127.0.0.1'
	} as Parameters<typeof reconcilePOST>[0];
}

beforeEach(() => {
	permissionAllowed = true;
	capturedPermissionChecks.length = 0;
	capturedReconcileCalls.length = 0;
	capturedToggleSuspendCalls.length = 0;
	capturedLogWrites.length = 0;
});

describe('Flux action routes normalize plural resource types', () => {
	test('reconcile route resolves plural params before RBAC and audit', async () => {
		await reconcilePOST(buildEvent('kustomizations'));

		expect(capturedPermissionChecks).toHaveLength(1);
		expect(capturedPermissionChecks[0][1]).toBe('write');
		expect(capturedPermissionChecks[0][2]).toBe('Kustomization');
		expect(capturedReconcileCalls[0]).toEqual([
			'Kustomization',
			'flux-system',
			'demo',
			'in-cluster'
		]);
		expect(capturedLogWrites[0][1]).toBe('Kustomization');
		expect(capturedLogWrites[0][2]).toBe('reconcile');
	});

	test('reconcile route accepts singular PascalCase resource names', async () => {
		const response = await reconcilePOST(buildEvent('GitRepository'));

		expect(response.status).toBe(200);
		expect(await response.json()).toEqual({
			success: true,
			message: 'Reconciliation triggered for demo'
		});
		expect(capturedPermissionChecks).toHaveLength(1);
		expect(capturedPermissionChecks[0][1]).toBe('write');
		expect(capturedPermissionChecks[0][2]).toBe('GitRepository');
		expect(capturedReconcileCalls[0]).toEqual([
			'GitRepository',
			'flux-system',
			'demo',
			'in-cluster'
		]);
		expect(capturedLogWrites[0][1]).toBe('GitRepository');
		expect(capturedLogWrites[0][2]).toBe('reconcile');
	});

	test('suspend route resolves plural params before RBAC and action execution', async () => {
		await suspendPOST(buildEvent('gitrepositories'));

		expect(capturedPermissionChecks[0][2]).toBe('GitRepository');
		expect(capturedToggleSuspendCalls[0]).toEqual([
			'GitRepository',
			'flux-system',
			'demo',
			true,
			'in-cluster'
		]);
		expect(capturedLogWrites[0][1]).toBe('GitRepository');
		expect(capturedLogWrites[0][2]).toBe('suspend');
	});

	test('resume route resolves plural params before RBAC and action execution', async () => {
		await resumePOST(buildEvent('helmreleases'));

		expect(capturedPermissionChecks[0][2]).toBe('HelmRelease');
		expect(capturedToggleSuspendCalls[0]).toEqual([
			'HelmRelease',
			'flux-system',
			'demo',
			false,
			'in-cluster'
		]);
		expect(capturedLogWrites[0][1]).toBe('HelmRelease');
		expect(capturedLogWrites[0][2]).toBe('resume');
	});

	test('invalid resource types are rejected before RBAC checks run', async () => {
		await expect(reconcilePOST(buildEvent('not-a-real-type'))).rejects.toMatchObject({
			status: 400,
			body: {
				message: 'Invalid resource type: not-a-real-type'
			}
		});

		expect(capturedPermissionChecks).toHaveLength(0);
		expect(capturedReconcileCalls).toHaveLength(0);
	});
});
