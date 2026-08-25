export const DEFAULT_FLUX_VERSION = 'v2.x.x';

interface FluxVersionMetadata {
	labels?: Record<string, string>;
	name?: string;
}

export interface FluxVersionDeployment {
	metadata?: FluxVersionMetadata;
}

export function getFluxDeploymentVersion(
	deployments: readonly FluxVersionDeployment[]
): string | undefined {
	const fluxDeployment = deployments.find(
		(deployment) =>
			deployment.metadata?.labels?.['app.kubernetes.io/part-of'] === 'flux' ||
			deployment.metadata?.name?.includes('source-controller')
	);

	return (
		fluxDeployment?.metadata?.labels?.['app.kubernetes.io/version'] ||
		deployments[0]?.metadata?.labels?.['app.kubernetes.io/version']
	);
}

export function getFluxNamespaceVersion(labels?: Record<string, string>): string {
	return labels?.['app.kubernetes.io/version'] || DEFAULT_FLUX_VERSION;
}
