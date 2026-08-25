import * as yaml from 'js-yaml';
import { REQUEST_LIMITS, formatSize } from '$lib/server/request-limits';

export interface ClusterCreateInput {
	name: string;
	description: string;
	kubeconfig: string;
}

export interface ClusterCreateValidationError {
	status: 400 | 413;
	error: string;
}

function validationError(
	error: string,
	status: ClusterCreateValidationError['status'] = 400
): ClusterCreateValidationError {
	return { status, error };
}

/** Validate the fields accepted by the admin cluster-create action. */
export function validateClusterCreateInput(
	input: ClusterCreateInput
): ClusterCreateValidationError | null {
	const { name, description, kubeconfig } = input;
	if (!name || !kubeconfig) {
		return validationError('Name and kubeconfig are required');
	}
	if (name.length < 3) {
		return validationError('Name must be at least 3 characters');
	}
	if (name.length > 100) {
		return validationError('Name must be at most 100 characters');
	}
	if (description && description.length > 500) {
		return validationError('Description must be at most 500 characters');
	}

	const kubeconfigSize = new TextEncoder().encode(kubeconfig).length;
	if (kubeconfigSize > REQUEST_LIMITS.KUBECONFIG_UPLOAD) {
		return validationError(
			`Kubeconfig is too large. Maximum size is ${formatSize(REQUEST_LIMITS.KUBECONFIG_UPLOAD)}, received ${formatSize(kubeconfigSize)}`,
			413
		);
	}

	try {
		const parsed = yaml.load(kubeconfig);
		if (
			parsed === null ||
			parsed === undefined ||
			typeof parsed !== 'object' ||
			!(parsed as { clusters?: unknown }).clusters ||
			!(parsed as { contexts?: unknown }).contexts
		) {
			return validationError('Invalid kubeconfig: missing clusters or contexts');
		}

		const config = parsed as {
			clusters?: unknown;
			contexts?: unknown;
			kind?: unknown;
			apiVersion?: unknown;
		};
		if (config.kind !== 'Config' || config.apiVersion !== 'v1') {
			return validationError('Invalid kubeconfig: must have kind: Config and apiVersion: v1');
		}
		if (!Array.isArray(config.clusters) || !Array.isArray(config.contexts)) {
			return validationError('Invalid kubeconfig: clusters and contexts must be arrays');
		}
	} catch {
		return validationError('Invalid kubeconfig format: could not parse as YAML or JSON');
	}

	return null;
}
