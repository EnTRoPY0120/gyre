import { afterEach, beforeEach, describe, expect, vi, test } from 'vitest';
import type { User } from '../lib/server/db/schema.js';
import * as actualValidation from '../lib/server/validation.js';
import { importFresh } from './helpers/import-fresh';
import { createKubernetesErrorsModuleStub, createRbacModuleStub } from './helpers/module-stubs';

type ReconcileRouteModule =
	typeof import('../routes/api/v1/flux/[resourceType]/[namespace]/[name]/reconcile/+server.js');
type ResumeRouteModule =
	typeof import('../routes/api/v1/flux/[resourceType]/[namespace]/[name]/resume/+server.js');
type SuspendRouteModule =
	typeof import('../routes/api/v1/flux/[resourceType]/[namespace]/[name]/suspend/+server.js');

const capturedPermissionChecks: unknown[][] = [];
const capturedReconcileCalls: unknown[][] = [];
const capturedToggleSuspendCalls: unknown[][] = [];
const capturedLogWrites: unknown[][] = [];
const capturedAuditCalls: unknown[][] = [];

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

const getResourceDef = (resourceType: string) =>
	resolveFluxResourceType(resourceType)
		? { group: 'source.toolkit.fluxcd.io', version: 'v1', plural: `${resourceType.toLowerCase()}s` }
		: undefined;

const getResourceTypeByPlural = (plural: string) => resolveFluxResourceType(plural);

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

function buildEvent(resourceType: string) {
	return {
		params: {
			resourceType,
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
	capturedAuditCalls.length = 0;

	vi.doMock('$lib/server/rbac.js', () =>
		createRbacModuleStub({
			checkPermission: async (...args: unknown[]) => {
				capturedPermissionChecks.push(args);
				return permissionAllowed;
			}
		})
	);

	vi.doMock('$lib/server/kubernetes/flux/actions', () => ({
		deleteResource: async () => {},
		reconcileResource: async (...args: unknown[]) => {
			capturedReconcileCalls.push(args);
			if (args[2] === 'bad') {
				throw new Error('reconcile failed');
			}
		},
		toggleSuspendResource: async (...args: unknown[]) => {
			capturedToggleSuspendCalls.push(args);
		}
	}));
	vi.doMock('$lib/server/kubernetes/flux/actions.js', () => ({
		deleteResource: async () => {},
		reconcileResource: async (...args: unknown[]) => {
			capturedReconcileCalls.push(args);
			if (args[2] === 'bad') {
				throw new Error('reconcile failed');
			}
		},
		toggleSuspendResource: async (...args: unknown[]) => {
			capturedToggleSuspendCalls.push(args);
		}
	}));

	vi.doMock('$lib/server/kubernetes/flux/resources', () => ({
		resolveFluxResourceType,
		getResourceDef,
		getResourceTypeByPlural,
		getAllResourcePlurals: () => ['kustomizations', 'gitrepositories', 'helmreleases']
	}));
	vi.doMock('$lib/server/kubernetes/flux/resources.js', () => ({
		resolveFluxResourceType,
		getResourceDef,
		getResourceTypeByPlural,
		getAllResourcePlurals: () => ['kustomizations', 'gitrepositories', 'helmreleases']
	}));

	const auditModuleStub = {
		logResourceWrite: async (...args: unknown[]) => {
			capturedLogWrites.push(args);
		},
		logAudit: async (...args: unknown[]) => {
			capturedAuditCalls.push(args);
		},
		logLogin: async () => {},
		logLogout: async () => {}
	};
	vi.doMock('$lib/server/audit', () => auditModuleStub);
	vi.doMock('$lib/server/audit.js', () => auditModuleStub);

	vi.doMock('$lib/server/kubernetes/errors.js', () => createKubernetesErrorsModuleStub());

	vi.doMock('$lib/server/validation', () => ({
		...actualValidation,
		validateK8sNamespace: () => {},
		validateK8sName: () => {}
	}));
	vi.doMock('$lib/server/validation.js', () => ({
		...actualValidation,
		validateK8sNamespace: () => {},
		validateK8sName: () => {}
	}));

	vi.doMock('$lib/server/kubernetes/flux/reconciliation-tracker', () => ({
		captureReconciliation: async () => {}
	}));
	vi.doMock('$lib/server/kubernetes/flux/reconciliation-tracker.js', () => ({
		captureReconciliation: async () => {}
	}));

	reconcilePOST = (
		await importFresh<ReconcileRouteModule>(
			'../routes/api/v1/flux/[resourceType]/[namespace]/[name]/reconcile/+server.js'
		)
	).POST;
	resumePOST = (
		await importFresh<ResumeRouteModule>(
			'../routes/api/v1/flux/[resourceType]/[namespace]/[name]/resume/+server.js'
		)
	).POST;
	suspendPOST = (
		await importFresh<SuspendRouteModule>(
			'../routes/api/v1/flux/[resourceType]/[namespace]/[name]/suspend/+server.js'
		)
	).POST;
});

afterEach(() => {
	vi.restoreAllMocks();
	vi.resetModules();
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
		expect(capturedAuditCalls[0][1]).toBe('write:reconcile');
		expect(capturedAuditCalls[0][2]).toMatchObject({ resourceType: 'Kustomization' });
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
		expect(capturedAuditCalls[0][1]).toBe('write:reconcile');
		expect(capturedAuditCalls[0][2]).toMatchObject({ resourceType: 'GitRepository' });
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
		expect(capturedAuditCalls[0][1]).toBe('write:suspend');
		expect(capturedAuditCalls[0][2]).toMatchObject({ resourceType: 'GitRepository' });
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
		expect(capturedAuditCalls[0][1]).toBe('write:resume');
		expect(capturedAuditCalls[0][2]).toMatchObject({ resourceType: 'HelmRelease' });
	});

	test('reconcile denies RBAC failures before action or audit side effects', async () => {
		permissionAllowed = false;

		await expect(reconcilePOST(buildEvent('kustomizations'))).rejects.toMatchObject({
			status: 403,
			body: { message: 'Permission denied' }
		});

		expect(capturedPermissionChecks).toHaveLength(1);
		expect(capturedReconcileCalls).toHaveLength(0);
		expect(capturedLogWrites).toHaveLength(0);
		expect(capturedAuditCalls).toHaveLength(0);
	});

	test('suspend denies RBAC failures before action or audit side effects', async () => {
		permissionAllowed = false;

		await expect(suspendPOST(buildEvent('gitrepositories'))).rejects.toMatchObject({
			status: 403,
			body: { message: 'Permission denied' }
		});

		expect(capturedPermissionChecks).toHaveLength(1);
		expect(capturedToggleSuspendCalls).toHaveLength(0);
		expect(capturedLogWrites).toHaveLength(0);
		expect(capturedAuditCalls).toHaveLength(0);
	});

	test('resume denies RBAC failures before action or audit side effects', async () => {
		permissionAllowed = false;

		await expect(resumePOST(buildEvent('helmreleases'))).rejects.toMatchObject({
			status: 403,
			body: { message: 'Permission denied' }
		});

		expect(capturedPermissionChecks).toHaveLength(1);
		expect(capturedToggleSuspendCalls).toHaveLength(0);
		expect(capturedLogWrites).toHaveLength(0);
		expect(capturedAuditCalls).toHaveLength(0);
	});

	test('invalid resource types are rejected before RBAC checks run', async () => {
		await expect(reconcilePOST(buildEvent('not-a-real-type'))).rejects.toMatchObject({
			status: 400,
			body: {
				message:
					'Invalid resource type: not-a-real-type. Valid types: kustomizations, gitrepositories, helmreleases'
			}
		});

		expect(capturedPermissionChecks).toHaveLength(0);
		expect(capturedReconcileCalls).toHaveLength(0);
	});
});
