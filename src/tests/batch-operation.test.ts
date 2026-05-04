import { afterEach, beforeEach, describe, expect, mock, test } from 'bun:test';
import { importFresh } from './helpers/import-fresh';
import { createRateLimiterModuleStub, createRbacModuleStub } from './helpers/module-stubs';

type BatchOperationModule = typeof import('../lib/server/flux/use-cases/batch-operation.js');

let runBatchFluxOperation: BatchOperationModule['runBatchFluxOperation'];
const reconciledNames: string[] = [];

function createRequest(resources: unknown[]) {
	return new Request('http://localhost/api/v1/flux/batch/reconcile', {
		method: 'POST',
		body: JSON.stringify({ resources })
	});
}

beforeEach(async () => {
	reconciledNames.length = 0;

	const rateLimiterModuleStub = createRateLimiterModuleStub();
	mock.module('$lib/server/rate-limiter', () => rateLimiterModuleStub);
	mock.module('$lib/server/rate-limiter.js', () => rateLimiterModuleStub);
	mock.module('$lib/server/rbac', () => createRbacModuleStub());
	mock.module('$lib/server/rbac.js', () => createRbacModuleStub());
	const auditModuleStub = {
		logAudit: async () => {
			throw new Error('audit unavailable');
		},
		logLogin: async () => {},
		logLogout: async () => {}
	};
	mock.module('$lib/server/audit', () => auditModuleStub);
	mock.module('$lib/server/audit.js', () => auditModuleStub);
	const kubernetesClientModuleStub = {
		deleteFluxResourcesBatch: async () => {},
		getCustomObjectsApi: async () => ({
			deleteNamespacedCustomObject: async () => {},
			patchNamespacedCustomObject: async ({ name }: { name: string }) => {
				reconciledNames.push(name);
				if (name === 'bad') {
					throw new Error('reconcile failed');
				}
			}
		}),
		handleK8sError: (err: unknown) => err
	};
	mock.module('$lib/server/kubernetes/client', () => kubernetesClientModuleStub);
	mock.module('$lib/server/kubernetes/client.js', () => kubernetesClientModuleStub);
	mock.module('$lib/server/kubernetes/flux/reconciliation-tracker.js', () => ({
		captureReconciliation: async () => {}
	}));
	const resourcesModuleStub = {
		getAllResourcePlurals: () => ['kustomizations'],
		getResourceDef: (resourceType: string) =>
			resourceType === 'Kustomization'
				? {
						group: 'kustomize.toolkit.fluxcd.io',
						version: 'v1',
						plural: 'kustomizations'
					}
				: undefined,
		resolveFluxResourceType: (resourceType: string) =>
			resourceType === 'kustomizations' || resourceType === 'Kustomization'
				? 'Kustomization'
				: undefined
	};
	mock.module('$lib/server/kubernetes/flux/resources', () => resourcesModuleStub);
	mock.module('$lib/server/kubernetes/flux/resources.js', () => resourcesModuleStub);

	runBatchFluxOperation = (
		await importFresh<BatchOperationModule>('../lib/server/flux/use-cases/batch-operation.js')
	).runBatchFluxOperation;
});

afterEach(() => {
	mock.restore();
});

describe('batch Flux operation auditing', () => {
	test('audit logging failures do not change per-item results or abort the loop', async () => {
		const response = await runBatchFluxOperation({
			getClientAddress: () => '127.0.0.1',
			locals: {
				cluster: 'in-cluster',
				user: { id: 'user-1', role: 'editor' }
			} as App.Locals,
			operation: 'reconcile',
			request: createRequest([
				{ type: 'kustomizations', namespace: 'flux-system', name: 'good' },
				{ type: 'kustomizations', namespace: 'flux-system', name: 'bad' }
			]),
			setHeaders: () => {}
		});

		expect(response.status).toBe(200);
		expect(await response.json()).toEqual({
			results: [
				{
					resource: { type: 'kustomizations', namespace: 'flux-system', name: 'good' },
					success: true,
					message: 'Reconciliation triggered for good'
				},
				{
					resource: { type: 'kustomizations', namespace: 'flux-system', name: 'bad' },
					success: false,
					message: 'reconcile failed'
				}
			],
			summary: {
				total: 2,
				successful: 1,
				failed: 1
			}
		});
	});
});
