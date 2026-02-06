import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getKubeConfig } from '$lib/server/kubernetes/client.js';
import * as k8s from '@kubernetes/client-node';

/**
 * GET /api/flux/version
 * Fetches the Flux version from the cluster by checking the 'app.kubernetes.io/version' label
 * on the flux-system deployments or namespace.
 */
export const GET: RequestHandler = async ({ locals }) => {
	try {
		const config = await getKubeConfig(locals.cluster);
		const appsApi = config.makeApiClient(k8s.AppsV1Api);
		const namespace = 'flux-system';

		try {
			// Try to list deployments in flux-system to find the common version label
			const response = await appsApi.listNamespacedDeployment({ namespace });
			const deployments = response.items;

			if (deployments.length > 0) {
				// Find a deployment that is part of Flux
				const fluxDep = deployments.find(
					(d) =>
						d.metadata?.labels?.['app.kubernetes.io/part-of'] === 'flux' ||
						d.metadata?.name?.includes('source-controller')
				);

				const version =
					fluxDep?.metadata?.labels?.['app.kubernetes.io/version'] ||
					deployments[0].metadata?.labels?.['app.kubernetes.io/version'];

				if (version) {
					return json({ version });
				}
			}

			// Fallback: check the namespace itself
			const coreApi = config.makeApiClient(k8s.CoreV1Api);
			const nsResponse = await coreApi.readNamespace({ name: namespace });
			const version = nsResponse.metadata?.labels?.['app.kubernetes.io/version'] || 'v2.x.x';

			return json({ version });
		} catch (err) {
			console.warn('Failed to fetch version from deployments, trying fallback:', err);
			return json({ version: 'v2.x.x' });
		}
	} catch (err) {
		return error(500, {
			message: err instanceof Error ? err.message : 'Unknown error fetching Flux version'
		});
	}
};
