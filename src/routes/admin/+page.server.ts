import type { PageServerLoad } from './$types';

function formatEnvironment(nodeEnv: string | undefined): string | null {
	if (!nodeEnv) return null;

	switch (nodeEnv.toLowerCase()) {
		case 'development':
			return 'Development';
		case 'production':
			return 'Production';
		case 'test':
			return 'Test';
		default:
			return nodeEnv;
	}
}

/**
 * Load function for admin settings landing page
 */
export const load: PageServerLoad = async () => {
	const inCluster = Boolean(process.env.KUBERNETES_SERVICE_HOST);

	return {
		systemInfo: {
			deploymentMode: inCluster ? 'In-cluster' : 'Local',
			clusterAccess: inCluster ? 'In-cluster Kubernetes API' : 'Local kubeconfig contexts',
			databaseEngine: 'SQLite',
			environment: formatEnvironment(process.env.NODE_ENV)
		}
	};
};
