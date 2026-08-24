import { error, isHttpError, isRedirect } from '@sveltejs/kit';
import { logger } from '$lib/server/logger.js';
import { getResourceTypeByPlural } from '$lib/server/kubernetes/flux/resources';
import { requireAuthenticatedUser, requireScopedPermission } from '$lib/server/http/guards.js';
import { classifyDiffError } from '$lib/server/kubernetes/flux/diff-errors';
import { validateK8sNamespace, validateK8sName } from '$lib/server/validation';

export interface DiffRouteContext {
	clusterId: string | undefined;
	forceRefresh: boolean;
	name: string;
	namespace: string;
	resourceType: 'Kustomization';
	fluxNamespace: string;
}

/** Validate the environment, route identity, and supported resource kind for drift detection. */
export function validateDiffRoute(params: {
	resourceType: string;
	namespace: string;
	name: string;
	clusterId: string | undefined;
	forceRefresh: boolean;
}): DiffRouteContext {
	const { resourceType: pluralType, namespace, name, clusterId, forceRefresh } = params;

	validateK8sNamespace(namespace);
	validateK8sName(name);

	if (!process.env.KUBERNETES_SERVICE_HOST) {
		throw error(503, {
			message:
				'Drift detection is only available when Gyre is deployed in a Kubernetes cluster. ' +
				'This feature requires in-cluster access to the source-controller and is not supported in local development mode.',
			code: 'ServiceUnavailable'
		});
	}

	const resourceType = getResourceTypeByPlural(pluralType);
	if (resourceType !== 'Kustomization') {
		throw error(400, {
			message: 'Diffing is only supported for Kustomizations',
			code: 'BadRequest'
		});
	}

	return {
		clusterId,
		forceRefresh,
		name,
		namespace,
		resourceType,
		fluxNamespace: process.env.FLUX_NAMESPACE || 'flux-system'
	};
}

/** Apply the read guard required by the drift endpoint. */
export async function authorizeDiffRoute(locals: App.Locals, namespace: string): Promise<void> {
	requireAuthenticatedUser(locals);
	await requireScopedPermission(locals, 'read', 'Kustomization', namespace);
}

/** Convert unexpected diff failures into the endpoint's stable public error shape. */
export function handleDiffRouteError(err: unknown): never {
	if (isHttpError(err) || isRedirect(err)) throw err;

	logger.error(err, 'Diff error:');
	const { status, message: clientMessage } = classifyDiffError(err);
	const code =
		status === 503 ? 'ServiceUnavailable' : status === 400 ? 'BadRequest' : 'InternalServerError';
	throw error(status, { message: clientMessage, code });
}
