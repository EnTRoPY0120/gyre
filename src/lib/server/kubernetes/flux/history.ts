import { getCoreV1Api } from '../client.js';
import type { FluxResourceType } from './resources.js';

export interface ResourceRevision {
	revision: string;
	timestamp: string;
	status: string;
	message?: string;
}

/**
 * Get history for a Flux resource
 */
export async function getResourceHistory(
	type: FluxResourceType,
	namespace: string,
	name: string
): Promise<ResourceRevision[]> {
	if (type === 'HelmRelease') {
		return getHelmReleaseHistory(namespace, name);
	}

	// For other resources, we might only have the current and maybe some info from events or status
	// For now, let's return a basic history from events?
	// Or just the current status as the only "version" if we don't track history elsewhere.
	// Actually, Flux status.history (for HR) or special annotations could be used.

	return [];
}

/**
 * Get HelmRelease history from Helm secrets
 */
async function getHelmReleaseHistory(namespace: string, name: string): Promise<ResourceRevision[]> {
	const coreApi = getCoreV1Api();

	try {
		// Helm releases are stored in secrets with label owner=helm and name=sh.helm.release.v1.NAME.vVERSION
		// We filter by name label if available or just list and filter ourselves.
		const response = await coreApi.listNamespacedSecret({
			namespace,
			labelSelector: `owner=helm,name=${name}`
		});

		const secrets = response.items || [];

		return secrets
			.map((secret) => {
				const version = secret.metadata?.name?.split('.v')?.pop() || '0';
				const status = secret.metadata?.labels?.['status'] || 'unknown';
				const timestamp = secret.metadata?.creationTimestamp?.toISOString() || '';

				return {
					revision: version,
					timestamp,
					status,
					message: `Helm Release v${version}`
				};
			})
			.sort((a, b) => parseInt(b.revision) - parseInt(a.revision));
	} catch (error) {
		console.error('Failed to fetch Helm history:', error);
		return [];
	}
}

/**
 * Rollback a HelmRelease to a specific version
 * This is done by patching the HelmRelease spec or triggering a helm rollback via the controller
 * Actually, for Flux HR, you'd typically change the version in the chart spec.
 * But for a "forced" rollback, we can use the HR's status to find what to rollback to.
 */
export async function rollbackResource(
	type: FluxResourceType,
	namespace: string,
	name: string,
	revision: string
): Promise<void> {
	if (type !== 'HelmRelease') {
		throw new Error('Rollback only supported for HelmRelease currently');
	}

	// For HelmRelease, we can annotate it to trigger a rollback?
	// Flux doesn't have a built-in "rollback to version X" annotation that works this way.
	// Usually you'd modify the Git source.
	// However, we can "suspend" and then manually perform helm operations? No, that's complex.
	// A better way is to provide a "Rollback" that just reverts the Spec to a known good state.
	// But we don't have the full spec history in DB yet.

	// For now, let's implement it as a "Reconcile" with a specific annotation if Flux supports it?
	// Actually, Flux has 'reconcile.fluxcd.io/requestedAt'.

	// If we want to support actual rollback, we might need to talk to the helm-controller
	// or perform the helm operation ourselves.

	// Suppress unused parameter warnings temporarily for this unimplemented function
	void namespace;
	void name;
	void revision;

	throw new Error('Not implemented: Rollback requires specific version patching logic');
}
