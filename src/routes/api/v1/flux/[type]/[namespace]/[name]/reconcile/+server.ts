import { error, json } from '@sveltejs/kit';
import { z } from '$lib/server/openapi';
import type { RequestHandler } from './$types';
import { reconcileResource } from '$lib/server/kubernetes/flux/actions.js';
import { resolveFluxResourceType } from '$lib/server/kubernetes/flux/resources.js';
import { checkPermission } from '$lib/server/rbac.js';
import { logResourceWrite, logAudit } from '$lib/server/audit.js';
import { handleApiError, sanitizeK8sErrorMessage } from '$lib/server/kubernetes/errors.js';
import { validateK8sNamespace, validateK8sName } from '$lib/server/validation.js';
import { captureReconciliation } from '$lib/server/kubernetes/flux/reconciliation-tracker.js';

export const _metadata = {
	POST: {
		summary: 'Trigger reconciliation',
		description:
			'Trigger an immediate reconciliation for a specific FluxCD resource by annotating it with the reconcile request annotation.',
		tags: ['Flux'],
		request: {
			params: z.object({
				type: z.string().openapi({ example: 'gitrepositories' }),
				namespace: z.string().openapi({ example: 'flux-system' }),
				name: z.string().openapi({ example: 'my-repo' })
			})
		},
		responses: {
			200: {
				description: 'Reconciliation triggered successfully',
				content: {
					'application/json': {
						schema: z.object({ success: z.boolean(), message: z.string() })
					}
				}
			},
			400: { description: 'Invalid namespace or resource name' },
			401: { description: 'Authentication required' },
			403: { description: 'Permission denied' }
		}
	}
};

export const POST: RequestHandler = async ({ params, locals, getClientAddress }) => {
	// Check authentication
	if (!locals.user) {
		throw error(401, { message: 'Authentication required' });
	}

	const { type, namespace, name } = params;
	const resolvedType = resolveFluxResourceType(type);

	validateK8sNamespace(namespace);
	validateK8sName(name);

	if (!resolvedType) {
		throw error(400, { message: `Invalid resource type: ${type}` });
	}

	// Check permission for write action
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

	try {
		await reconcileResource(resolvedType, namespace, name, locals.cluster);

		// Log the audit event
		await logResourceWrite(
			locals.user,
			resolvedType,
			'reconcile',
			name,
			namespace,
			locals.cluster,
			{
				ipAddress: getClientAddress()
			}
		);

		// Capture a trigger-only history entry. No resource is passed so only
		// the trigger metadata (who, when) is stored — no stale revision or status
		// from the previous cycle. The actual reconciliation outcome will be
		// captured separately by the event watcher once FluxCD completes the cycle.
		try {
			await captureReconciliation({
				resourceType: resolvedType,
				namespace,
				name,
				clusterId: locals.cluster ?? 'in-cluster',
				triggerType: 'manual',
				triggeredByUserId: locals.user.id
			});
		} catch {
			// History capture is best-effort; don't fail the reconcile response
		}

		return json({ success: true, message: `Reconciliation triggered for ${name}` });
	} catch (err) {
		// Log failed audit event with sanitized error and success: false
		await logAudit(locals.user, 'write:reconcile', {
			resourceType: resolvedType,
			resourceName: name,
			namespace,
			clusterId: locals.cluster,
			ipAddress: getClientAddress(),
			success: false,
			details: {
				error: sanitizeK8sErrorMessage(err instanceof Error ? err.message : String(err))
			}
		});

		handleApiError(err, `Error reconciling ${name}`);
	}
};
