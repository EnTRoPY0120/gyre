import { env } from '$env/dynamic/private';
import type { PageServerLoad } from './$types';
import { formatEnvironment } from './page-helpers.js';

/**
 * Load function for admin settings landing page
 */
export const load: PageServerLoad = async () => {
	const inCluster = Boolean(env.KUBERNETES_SERVICE_HOST);

	return {
		systemInfo: {
			deploymentMode: inCluster ? 'In-cluster' : 'Local',
			clusterAccess: inCluster ? 'In-cluster Kubernetes API' : 'Local kubeconfig contexts',
			databaseEngine: 'SQLite',
			environment: formatEnvironment(env.NODE_ENV)
		}
	};
};
