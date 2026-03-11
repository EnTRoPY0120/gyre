import { error, json } from '@sveltejs/kit';
import { z } from '$lib/server/openapi';
import type { RequestHandler } from './$types';
import { toggleSuspendResource } from '$lib/server/kubernetes/flux/actions';
import type { FluxResourceType } from '$lib/server/kubernetes/flux/resources';
import { checkPermission } from '$lib/server/rbac.js';
import { logResourceWrite, logAudit } from '$lib/server/audit.js';
import { handleApiError, sanitizeK8sErrorMessage } from '$lib/server/kubernetes/errors.js';

export const _metadata = {
	POST: {
		summary: 'Suspend resource',
		description:
			'Suspend reconciliation for a specific FluxCD resource. The resource will not be reconciled until resumed.',
		tags: ['Flux'],
		request: {
			params: z.object({
				type: z.string().openapi({ example: 'GitRepository' }),
				namespace: z.string().openapi({ example: 'flux-system' }),
				name: z.string().openapi({ example: 'my-repo' })
			})
		},
		responses: {
			200: {
				description: 'Resource suspended successfully',
				content: {
					'application/json': {
						schema: z.object({ success: z.boolean(), message: z.string() })
					}
				}
			},
			401: { description: 'Authentication required' },
			403: { description: 'Permission denied' },
			500: { description: 'Internal server error' }
		}
	}
};

export const POST: RequestHandler = async ({ params, locals, getClientAddress }) => {
	// Check authentication
	if (!locals.user) {
		throw error(401, { message: 'Authentication required' });
	}

	const { type, namespace, name } = params;

	// Check permission for write action
	const hasPermission = await checkPermission(
		locals.user,
		'write',
		type as FluxResourceType,
		namespace,
		locals.cluster
	);

	if (!hasPermission) {
		throw error(403, { message: 'Permission denied' });
	}

	try {
		await toggleSuspendResource(type as FluxResourceType, namespace, name, true, locals.cluster);

		// Log the audit event
		await logResourceWrite(locals.user, type, 'suspend', name, namespace, locals.cluster, {
			ipAddress: getClientAddress()
		});

		return json({ success: true, message: `Suspended ${name}` });
	} catch (err) {
		// Log failed audit event with sanitized error and success: false
		await logAudit(locals.user, 'write:suspend', {
			resourceType: type,
			resourceName: name,
			namespace,
			clusterId: locals.cluster,
			ipAddress: getClientAddress(),
			success: false,
			details: {
				error: sanitizeK8sErrorMessage(err instanceof Error ? err.message : String(err))
			}
		});

		handleApiError(err, `Error suspending ${name}`);
	}
};
