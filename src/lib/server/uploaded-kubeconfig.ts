import yaml from 'js-yaml';

export class UploadedKubeconfigValidationError extends Error {
	constructor(message: string) {
		super(message);
		this.name = 'UploadedKubeconfigValidationError';
	}
}

export function validateUploadedKubeconfig(kubeconfig: string): void {
	try {
		const parsed = yaml.load(kubeconfig);
		if (
			parsed === null ||
			parsed === undefined ||
			typeof parsed !== 'object' ||
			!(parsed as { clusters?: unknown }).clusters ||
			!(parsed as { contexts?: unknown }).contexts
		) {
			throw new UploadedKubeconfigValidationError(
				'Invalid kubeconfig: missing clusters or contexts'
			);
		}

		const config = parsed as {
			clusters?: unknown;
			contexts?: unknown;
			kind?: unknown;
			apiVersion?: unknown;
		};
		if (config.kind !== 'Config' || config.apiVersion !== 'v1') {
			throw new UploadedKubeconfigValidationError(
				'Invalid kubeconfig: must have kind: Config and apiVersion: v1'
			);
		}

		if (!Array.isArray(config.clusters) || !Array.isArray(config.contexts)) {
			throw new UploadedKubeconfigValidationError(
				'Invalid kubeconfig: clusters and contexts must be arrays'
			);
		}
	} catch (error) {
		if (error instanceof UploadedKubeconfigValidationError) {
			throw error;
		}

		if (error instanceof yaml.YAMLException) {
			throw new UploadedKubeconfigValidationError(
				'Invalid kubeconfig format: could not parse as YAML or JSON'
			);
		}

		throw error;
	}
}
