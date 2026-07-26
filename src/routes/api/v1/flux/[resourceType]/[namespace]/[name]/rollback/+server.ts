import { json } from '@sveltejs/kit';
import { z } from '$lib/server/openapi';
import type { RequestHandler } from './$types';
import { rollbackResource } from '$lib/server/kubernetes/flux/history';
import { handleApiError, sanitizeK8sErrorMessage } from '$lib/server/kubernetes/errors.js';
import { validateK8sNamespace, validateK8sName } from '$lib/server/validation';
import {
	logPrivilegedMutationFailure,
	logPrivilegedMutationSuccess,
	requireFluxResourceWrite
} from '$lib/server/http/guards.js';
import { parseRollbackRequestBody } from '$lib/server/flux/use-cases/rollback.js';

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
	const { namespace, name } = params;

	validateK8sNamespace(namespace);
	validateK8sName(name);

	const { dryRun, historyId, revision, target } = await parseRollbackRequestBody(request);

	const context = await requireFluxResourceWrite(locals, params);

	try {
		const result = await rollbackResource(
			context.resourceType,
			context.namespace,
			context.name,
			target,
			context.clusterId,
			dryRun
		);

		if (dryRun && result) {
			// Dry-run returns a preview of the patch without mutating anything — intentionally not audited.
			return json({ dryRun: true, patch: result.patch, historyEntry: result.historyEntry });
		}

		await logPrivilegedMutationSuccess({
			action: 'rollback',
			user: context.user,
			resourceType: context.resourceType,
			name: context.name,
			namespace: context.namespace,
			clusterId: context.clusterId,
			ipAddress: getClientAddress(),
			details: {
				targetRevision: revision,
				targetHistoryId: historyId
			}
		});

		return json({
			success: true,
			message: `Successfully initiated rollback to ${target}`
		});
	} catch (err: unknown) {
		await logPrivilegedMutationFailure({
			action: 'rollback',
			user: context.user,
			resourceType: context.resourceType,
			name: context.name,
			namespace: context.namespace,
			clusterId: context.clusterId,
			ipAddress: getClientAddress(),
			details: {
				targetRevision: revision,
				targetHistoryId: historyId
			},
			error: sanitizeK8sErrorMessage(err instanceof Error ? err.message : String(err))
		});

		handleApiError(err, `Failed to perform rollback for ${context.name}`);
	}
};
