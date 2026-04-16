import { afterEach, beforeEach, describe, expect, mock, test } from 'bun:test';
import type { User } from '../lib/server/db/schema.js';
import * as actualValidation from '../lib/server/validation.js';
import { importFresh } from './helpers/import-fresh';
import { createKubernetesErrorsModuleStub, createRbacModuleStub } from './helpers/module-stubs';

type ReconcileRouteModule =
	typeof import('../routes/api/v1/flux/[type]/[namespace]/[name]/reconcile/+server.js');
type ResumeRouteModule =
	typeof import('../routes/api/v1/flux/[type]/[namespace]/[name]/resume/+server.js');
type SuspendRouteModule =
	typeof import('../routes/api/v1/flux/[type]/[namespace]/[name]/suspend/+server.js');

const capturedPermissionChecks: unknown[][] = [];
const capturedReconcileCalls: unknown[][] = [];
const capturedToggleSuspendCalls: unknown[][] = [];
const capturedLogWrites: unknown[][] = [];

let permissionAllowed = true;
let reconcilePOST: ReconcileRouteModule['POST'];
let resumePOST: ResumeRouteModule['POST'];
let suspendPOST: SuspendRouteModule['POST'];

const resolveFluxResourceType = (resourceType: string) => {
	if (resourceType === 'kustomizations') return 'Kustomization';
	if (resourceType === 'gitrepositories') return 'GitRepository';
	if (resourceType === 'helmreleases') return 'HelmRelease';
	if (resourceType === 'Kustomization') return 'Kustomization';
	if (resourceType === 'GitRepository') return 'GitRepository';
	if (resourceType === 'HelmRelease') return 'HelmRelease';
	return undefined;
};

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
	} as Parameters<ReconcileRouteModule['POST']>[0];
}

beforeEach(async () => {
	permissionAllowed = true;
	capturedPermissionChecks.length = 0;
	capturedReconcileCalls.length = 0;
	capturedToggleSuspendCalls.length = 0;
	capturedLogWrites.length = 0;

	mock.module('$lib/server/rbac.js', () =>
		createRbacModuleStub({
			checkPermission: async (...args: unknown[]) => {
				capturedPermissionChecks.push(args);
				return permissionAllowed;
			}
		})
	);

	mock.module('$lib/server/kubernetes/flux/actions', () => ({
		reconcileResource: async (...args: unknown[]) => {
			capturedReconcileCalls.push(args);
		},
		toggleSuspendResource: async (...args: unknown[]) => {
			capturedToggleSuspendCalls.push(args);
		}
	}));

	mock.module('$lib/server/kubernetes/flux/resources', () => ({
		resolveFluxResourceType
	}));
	mock.module('$lib/server/kubernetes/flux/resources.js', () => ({
		resolveFluxResourceType
	}));

	mock.module('$lib/server/audit.js', () => ({
		logResourceWrite: async (...args: unknown[]) => {
			capturedLogWrites.push(args);
		},
		logAudit: async () => {}
	}));

	mock.module('$lib/server/kubernetes/errors.js', () => createKubernetesErrorsModuleStub());

	mock.module('$lib/server/validation', () => ({
		...actualValidation,
		validateK8sNamespace: () => {},
		validateK8sName: () => {}
	}));

	mock.module('$lib/server/kubernetes/flux/reconciliation-tracker', () => ({
		captureReconciliation: async () => {}
	}));

	reconcilePOST = (
		await importFresh<ReconcileRouteModule>(
			'../routes/api/v1/flux/[type]/[namespace]/[name]/reconcile/+server.js'
		)
	).POST;
	resumePOST = (
		await importFresh<ResumeRouteModule>(
			'../routes/api/v1/flux/[type]/[namespace]/[name]/resume/+server.js'
		)
	).POST;
	suspendPOST = (
		await importFresh<SuspendRouteModule>(
			'../routes/api/v1/flux/[type]/[namespace]/[name]/suspend/+server.js'
		)
	).POST;
});

afterEach(() => {
	mock.restore();
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
