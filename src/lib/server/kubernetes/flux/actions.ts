import { getCustomObjectsApi, handleK8sError } from '../client';
import { getResourceDef, resolveFluxResourceType } from './resources';

function requireResourceDef(resourceType: string) {
	const resolvedType = resolveFluxResourceType(resourceType);
	const resourceDef = resolvedType ? getResourceDef(resolvedType) : undefined;

	if (!resourceDef) {
		throw new Error(`Unknown resource type: ${resourceType}`);
	}

	return resourceDef;
}

/**
 * Suspend or Resume a FluxCD resource
 * Patches .spec.suspend
 */
export async function toggleSuspendResource(
	resourceType: string,
	namespace: string,
	name: string,
	suspend: boolean,
	context?: string
): Promise<void> {
	const resourceDef = requireResourceDef(resourceType);

	const api = await getCustomObjectsApi(context);

	// JSON Patch to update spec.suspend
	// Use 'add' which works as 'replace' if exists or creates if missing
	const patchBody = [
		{
			op: 'add',
			path: '/spec/suspend',
			value: suspend
		}
	];

	try {
		await api.patchNamespacedCustomObject(
			{
				group: resourceDef.group,
				version: resourceDef.version,
				namespace,
				plural: resourceDef.plural,
				name,
				body: patchBody
			},
			{
				headers: { 'Content-Type': 'application/json-patch+json' }
			} as Record<string, unknown>
		);
	} catch (error) {
		throw handleK8sError(error, `suspend/resume ${name}`);
	}
}

/**
 * Trigger immediate reconciliation
 * Adds reconcile.fluxcd.io/requestedAt annotation
 */
export async function reconcileResource(
	resourceType: string,
	namespace: string,
	name: string,
	context?: string
): Promise<void> {
	const resourceDef = requireResourceDef(resourceType);

	const api = await getCustomObjectsApi(context);
	const now = new Date().toISOString();

	try {
		// Use merge patch to atomically set the annotation.
		// This avoids the TOCTOU race of GET-then-PATCH: merge patch deep-merges
		// the provided object, so Kubernetes creates the annotations map if absent.
		const patchBody = {
			metadata: {
				annotations: {
					'reconcile.fluxcd.io/requestedAt': now
				}
			}
		};

		await api.patchNamespacedCustomObject(
			{
				group: resourceDef.group,
				version: resourceDef.version,
				namespace,
				plural: resourceDef.plural,
				name,
				body: patchBody
			},
			{
				headers: { 'Content-Type': 'application/merge-patch+json' }
			} as Record<string, unknown>
		);
	} catch (error) {
		throw handleK8sError(error, `reconcile ${name}`);
	}
}

/**
 * Delete a FluxCD resource
 */
export async function deleteResource(
	resourceType: string,
	namespace: string,
	name: string,
	context?: string
): Promise<void> {
	const resourceDef = requireResourceDef(resourceType);

	const api = await getCustomObjectsApi(context);

	try {
		await api.deleteNamespacedCustomObject({
			group: resourceDef.group,
			version: resourceDef.version,
			namespace,
			plural: resourceDef.plural,
			name
		});
	} catch (error) {
		throw handleK8sError(error, `delete ${name}`);
	}
}
