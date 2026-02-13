import { getCustomObjectsApi, getFluxResource, handleK8sError } from '../client';
import { getResourceDef, getResourceTypeByPlural } from './resources';
import type { FluxResourceType } from './resources';
import type { ConfigurationOptions } from '@kubernetes/client-node';

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
	let resourceDef = getResourceDef(resourceType);
	if (!resourceDef) {
		const key = getResourceTypeByPlural(resourceType);
		if (key) {
			resourceDef = getResourceDef(key);
		}
	}

	if (!resourceDef) {
		throw new Error(`Unknown resource type: ${resourceType}`);
	}

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
			} as ConfigurationOptions
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
	let resourceDef = getResourceDef(resourceType);
	if (!resourceDef) {
		const key = getResourceTypeByPlural(resourceType);
		if (key) {
			resourceDef = getResourceDef(key);
		}
	}

	if (!resourceDef) {
		throw new Error(`Unknown resource type: ${resourceType}`);
	}

	const api = await getCustomObjectsApi(context);
	const now = new Date().toISOString();

	try {
		// Fetch current resource to check if annotations exist
		const resource = await getFluxResource(
			resourceDef.kind as FluxResourceType,
			namespace,
			name,
			context
		);
		const hasAnnotations = !!resource.metadata.annotations;

		let patchBody;

		if (hasAnnotations) {
			// Annotations exist, add/replace the specific key
			patchBody = [
				{
					op: 'add',
					path: '/metadata/annotations/reconcile.fluxcd.io~1requestedAt',
					value: now
				}
			];
		} else {
			// Annotations missing, create the map
			patchBody = [
				{
					op: 'add',
					path: '/metadata/annotations',
					value: {
						'reconcile.fluxcd.io/requestedAt': now
					}
				}
			];
		}

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
			} as ConfigurationOptions
		);
	} catch (error) {
		throw handleK8sError(error, `reconcile ${name}`);
	}
}
