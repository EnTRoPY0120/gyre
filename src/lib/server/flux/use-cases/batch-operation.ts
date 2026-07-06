import { error, json } from '@sveltejs/kit';
import { MAX_BATCH_SIZE } from '$lib/server/config/limits.js';
import {
	type BatchOperationResult,
	type BatchResourceItem
} from '$lib/server/kubernetes/flux/batch-schemas.js';
import {
	deleteResource,
	reconcileResource,
	toggleSuspendResource
} from '$lib/server/kubernetes/flux/actions.js';
import { captureReconciliation } from '$lib/server/kubernetes/flux/reconciliation-tracker.js';
import type { FluxResourceType } from '$lib/server/kubernetes/flux/resources.js';
import { sanitizeK8sErrorMessage } from '$lib/server/kubernetes/errors.js';
import {
	enforceUserRateLimitPreset,
	logPrivilegedMutationFailure,
	logPrivilegedMutationSuccess,
	requireClusterContext,
	requireFluxResourceAdmin,
	requireFluxResourceWrite,
	resolveFluxRouteResourceType,
	validateFluxRouteIdentity
} from '$lib/server/http/guards.js';

export type BatchFluxOperation = 'reconcile' | 'suspend' | 'resume' | 'delete';

export interface RunBatchFluxOperationParams {
	getClientAddress: () => string;
	locals: App.Locals;
	operation: BatchFluxOperation;
	request: Request;
	setHeaders: (headers: Record<string, string>) => void;
}

const auditActions = {
	reconcile: 'write:reconcile',
	suspend: 'write:suspend',
	resume: 'write:resume',
	delete: 'admin:delete'
} satisfies Record<BatchFluxOperation, string>;

const successMessages = {
	reconcile: (name: string) => `Reconciliation triggered for ${name}`,
	suspend: (name: string) => `Suspended ${name}`,
	resume: (name: string) => `Resumed ${name}`,
	delete: (name: string) => `Deleted ${name}`
} satisfies Record<BatchFluxOperation, (name: string) => string>;

function defaultResource(resource: unknown): BatchResourceItem {
	if (resource && typeof resource === 'object') {
		const item = resource as Partial<BatchResourceItem>;
		return {
			type: typeof item.type === 'string' ? item.type : 'unknown',
			namespace: typeof item.namespace === 'string' ? item.namespace : 'unknown',
			name: typeof item.name === 'string' ? item.name : 'unknown'
		};
	}

	return { type: 'unknown', namespace: 'unknown', name: 'unknown' };
}

export async function parseBatchOperationRequestBody(request: Request): Promise<unknown[]> {
	let body: { resources?: unknown[] } | null;
	try {
		body = await request.json();
	} catch {
		throw error(400, { message: 'Invalid JSON in request body' });
	}

	if (body === null || typeof body !== 'object') {
		throw error(400, { message: 'Missing or invalid resources array in request body' });
	}

	if (!body.resources || !Array.isArray(body.resources)) {
		throw error(400, { message: 'Missing or invalid resources array in request body' });
	}

	if (body.resources.length > MAX_BATCH_SIZE) {
		throw error(400, {
			message: `Batch size exceeded: maximum ${MAX_BATCH_SIZE} resources allowed per request`
		});
	}

	return body.resources;
}

export function validateBatchResource(resource: unknown): BatchResourceItem {
	if (
		!resource ||
		typeof resource !== 'object' ||
		typeof (resource as BatchResourceItem).type !== 'string' ||
		typeof (resource as BatchResourceItem).namespace !== 'string' ||
		typeof (resource as BatchResourceItem).name !== 'string' ||
		!(resource as BatchResourceItem).type ||
		!(resource as BatchResourceItem).namespace ||
		!(resource as BatchResourceItem).name
	) {
		throw new Error('Invalid resource: missing required fields (type, namespace, name)');
	}

	return resource as BatchResourceItem;
}

async function authorizeBatchResource(
	locals: App.Locals,
	operation: BatchFluxOperation,
	resource: BatchResourceItem
): Promise<FluxResourceType> {
	validateFluxRouteIdentity(resource.namespace, resource.name);
	const resourceType = resolveFluxRouteResourceType(resource.type);

	if (operation === 'delete') {
		await requireFluxResourceAdmin(locals, {
			resourceType: resource.type,
			namespace: resource.namespace,
			name: resource.name
		});
	} else {
		await requireFluxResourceWrite(locals, {
			resourceType: resource.type,
			namespace: resource.namespace,
			name: resource.name
		});
	}

	return resourceType;
}

async function runSingleOperation(
	operation: BatchFluxOperation,
	resourceType: FluxResourceType,
	namespace: string,
	name: string,
	clusterId: string,
	userId: string | null
) {
	if (operation === 'reconcile') {
		await reconcileResource(resourceType, namespace, name, clusterId);
		try {
			await captureReconciliation({
				resourceType,
				namespace,
				name,
				clusterId,
				triggerType: 'manual',
				triggeredByUserId: userId
			});
		} catch {
			// History capture is best-effort; don't fail the reconcile response.
		}
	} else if (operation === 'suspend' || operation === 'resume') {
		await toggleSuspendResource(resourceType, namespace, name, operation === 'suspend', clusterId);
	} else {
		await deleteResource(resourceType, namespace, name, clusterId);
	}
}

function batchErrorMessage(err: unknown): string {
	return err &&
		typeof err === 'object' &&
		'status' in err &&
		(err as { status: number }).status === 403
		? 'Permission denied'
		: sanitizeK8sErrorMessage(err instanceof Error ? err.message : String(err));
}

async function logBatchSuccess(params: {
	action: string;
	clusterId: string;
	ipAddress: string;
	resource: BatchResourceItem;
	resourceType: FluxResourceType;
	user: NonNullable<App.Locals['user']>;
}) {
	try {
		await logPrivilegedMutationSuccess({
			action: params.action,
			user: params.user,
			resourceType: params.resourceType,
			name: params.resource.name,
			namespace: params.resource.namespace,
			clusterId: params.clusterId,
			ipAddress: params.ipAddress
		});
	} catch {
		// Audit logging is best-effort and must not change batch results.
	}
}

async function logBatchFailure(params: {
	action: string;
	clusterId: string;
	ipAddress: string;
	message: string;
	resource: BatchResourceItem;
	user: NonNullable<App.Locals['user']>;
}) {
	try {
		await logPrivilegedMutationFailure({
			action: params.action,
			user: params.user,
			resourceType: params.resource.type,
			name: params.resource.name,
			namespace: params.resource.namespace,
			clusterId: params.clusterId,
			ipAddress: params.ipAddress,
			error: params.message
		});
	} catch {
		// Audit logging is best-effort and must not abort the batch loop.
	}
}

async function runBatchItem(params: {
	action: string;
	clusterId: string;
	ipAddress: string;
	locals: App.Locals;
	operation: BatchFluxOperation;
	rawResource: unknown;
	user: NonNullable<App.Locals['user']>;
}): Promise<BatchOperationResult> {
	const displayResource = defaultResource(params.rawResource);

	try {
		const resource = validateBatchResource(params.rawResource);
		const resourceType = await authorizeBatchResource(params.locals, params.operation, resource);
		await runSingleOperation(
			params.operation,
			resourceType,
			resource.namespace,
			resource.name,
			params.clusterId,
			params.user.id
		);

		await logBatchSuccess({
			action: params.action,
			clusterId: params.clusterId,
			ipAddress: params.ipAddress,
			resource,
			resourceType,
			user: params.user
		});

		return {
			resource,
			success: true,
			message: successMessages[params.operation](resource.name)
		};
	} catch (err) {
		const message = batchErrorMessage(err);
		await logBatchFailure({
			action: params.action,
			clusterId: params.clusterId,
			ipAddress: params.ipAddress,
			message,
			resource: displayResource,
			user: params.user
		});

		return {
			resource: displayResource,
			success: false,
			message
		};
	}
}

export async function runBatchFluxOperation({
	getClientAddress,
	locals,
	operation,
	request,
	setHeaders
}: RunBatchFluxOperationParams) {
	const user = enforceUserRateLimitPreset({ setHeaders }, locals, 'batch');
	const clusterId = requireClusterContext(locals);
	const ipAddress = getClientAddress();
	const action = auditActions[operation];
	const resources = await parseBatchOperationRequestBody(request);
	const results: BatchOperationResult[] = [];
	for (const rawResource of resources) {
		results.push(
			await runBatchItem({
				action,
				clusterId,
				ipAddress,
				locals,
				operation,
				rawResource,
				user
			})
		);
	}

	const successful = results.filter((result) => result.success).length;
	return json({
		results,
		summary: {
			total: results.length,
			successful,
			failed: results.length - successful
		}
	});
}
