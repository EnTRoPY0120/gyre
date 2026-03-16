import { json, error } from '@sveltejs/kit';
import { z } from '$lib/server/openapi';
import type { RequestHandler } from './$types';
import { rollbackResource } from '$lib/server/kubernetes/flux/history';
import { getResourceTypeByPlural } from '$lib/server/kubernetes/flux/resources';
import { checkPermission } from '$lib/server/rbac';
import { handleApiError, sanitizeK8sErrorMessage } from '$lib/server/kubernetes/errors.js';
import { logResourceWrite, logAudit } from '$lib/server/audit.js';
import { validateK8sNamespace, validateK8sName } from '$lib/server/validation';

export const _metadata = {
	POST: {
		summary: 'Rollback resource',
		description:
			'Roll back a FluxCD resource to a previous revision. Provide either a revision string or a historyId from the reconciliation history.',
		tags: ['Flux'],
		request: {
			params: z.object({
				resourceType: z.string().openapi({ example: 'kustomizations' }),
				namespace: z.string().openapi({ example: 'flux-system' }),
				name: z.string().openapi({ example: 'my-app' })
			}),
			body: {
				content: {
					'application/json': {
						schema: z
							.object({
								revision: z.string().max(500).optional().openapi({ example: 'main@sha1:abc123' }),
								historyId: z.string().max(500).optional().openapi({ example: '01J...' }),
								dryRun: z
									.boolean()
									.optional()
									.openapi({ description: 'If true, return the patch preview without applying it' })
							})
							.openapi({
								description:
									'At least one of "revision" or "historyId" must be provided. "historyId" takes precedence if both are given.'
							})
					}
				}
			}
		},
		responses: {
			200: {
				description: 'Rollback initiated successfully, or dry-run patch preview',
				content: {
					'application/json': {
						schema: z.union([
							z.object({ success: z.boolean(), message: z.string() }),
							z.object({
								dryRun: z.literal(true),
								patch: z.record(z.string(), z.unknown()),
								historyEntry: z.object({ id: z.string(), revision: z.string().nullable() })
							})
						])
					}
				}
			},
			400: {
				description: 'Invalid resource type or missing revision/historyId',
				content: { 'application/json': { schema: z.object({ message: z.string() }) } }
			},
			401: { description: 'Authentication required' },
			403: { description: 'Permission denied' },
			500: { description: 'Internal server error' }
		}
	}
};

export const POST: RequestHandler = async ({ params, locals, request, getClientAddress }) => {
	if (!locals.user) {
		throw error(401, { message: 'Authentication required' });
	}

	const { resourceType, namespace, name } = params;

	validateK8sNamespace(namespace);
	validateK8sName(name);

	let revision: string | undefined;
	let historyId: string | undefined;
	let dryRun = false;

	try {
		const body = await request.json();
		if (body.revision !== undefined && typeof body.revision !== 'string') {
			throw error(400, { message: 'revision must be a string' });
		}
		if (body.historyId !== undefined && typeof body.historyId !== 'string') {
			throw error(400, { message: 'historyId must be a string' });
		}
		if (body.dryRun !== undefined && typeof body.dryRun !== 'boolean') {
			throw error(400, { message: 'dryRun must be a boolean' });
		}
		revision = body.revision;
		historyId = body.historyId;
		dryRun = body.dryRun === true;
	} catch (err) {
		if (err && typeof err === 'object' && 'status' in err) throw err;
		throw error(400, { message: 'Invalid JSON payload' });
	}

	// Enforce max length (schema validates on OpenAPI side; check here for direct calls)
	if (revision && revision.length > 500) {
		throw error(400, { message: 'revision exceeds maximum length of 500 characters' });
	}
	if (historyId && historyId.length > 500) {
		throw error(400, { message: 'historyId exceeds maximum length of 500 characters' });
	}

	// Either revision or historyId must be provided
	if (!revision && !historyId) {
		throw error(400, { message: 'Either revision or historyId is required for rollback' });
	}

	const resolvedType = getResourceTypeByPlural(resourceType);

	if (!resolvedType) {
		throw error(400, { message: `Invalid resource type: ${resourceType}` });
	}

	// Check permission (admin/write access needed for rollback)
	const hasPermission = await checkPermission(
		locals.user,
		'write',
		resolvedType,
		namespace,
		locals.cluster
	);

	if (!hasPermission) {
		throw error(403, { message: 'Permission denied' });
	}

	// Use historyId if provided, otherwise use revision
	const target = historyId || revision || '';

	try {
		const result = await rollbackResource(
			resolvedType,
			namespace,
			name,
			target,
			locals.cluster,
			dryRun
		);

		if (dryRun && result) {
			// Dry-run returns a preview of the patch without mutating anything — intentionally not audited.
			return json({ dryRun: true, patch: result.patch, historyEntry: result.historyEntry });
		}

		// Log the audit event
		await logResourceWrite(locals.user, resolvedType, 'rollback', name, namespace, locals.cluster, {
			ipAddress: getClientAddress(),
			targetRevision: revision,
			targetHistoryId: historyId
		});

		return json({
			success: true,
			message: `Successfully initiated rollback to ${target}`
		});
	} catch (err: unknown) {
		// Log failed audit event with flattened details and success: false
		await logAudit(locals.user, 'write:rollback', {
			resourceType: resolvedType,
			resourceName: name,
			namespace,
			clusterId: locals.cluster,
			ipAddress: getClientAddress(),
			success: false,
			details: {
				targetRevision: revision,
				targetHistoryId: historyId,
				error: sanitizeK8sErrorMessage(err instanceof Error ? err.message : String(err))
			}
		});

		handleApiError(err, `Failed to perform rollback for ${name}`);
	}
};
