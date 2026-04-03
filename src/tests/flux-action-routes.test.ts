import { beforeEach, describe, expect, mock, test } from 'bun:test';
import type { User } from '../lib/server/db/schema.js';

const capturedPermissionChecks: unknown[][] = [];
const capturedReconcileCalls: unknown[][] = [];
const capturedToggleSuspendCalls: unknown[][] = [];
const capturedLogWrites: unknown[][] = [];

let permissionAllowed = true;

mock.module('$lib/server/rbac.js', () => ({
	checkPermission: async (...args: unknown[]) => {
		capturedPermissionChecks.push(args);
		return permissionAllowed;
	}
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
	logAudit: async () => {}
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

import { POST as reconcilePOST } from '../routes/api/v1/flux/[type]/[namespace]/[name]/reconcile/+server.js';
import { POST as resumePOST } from '../routes/api/v1/flux/[type]/[namespace]/[name]/resume/+server.js';
import { POST as suspendPOST } from '../routes/api/v1/flux/[type]/[namespace]/[name]/suspend/+server.js';

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
