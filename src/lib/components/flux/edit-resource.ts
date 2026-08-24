import * as yaml from 'js-yaml';
import type { K8sResource } from '$lib/types/kubernetes';

/** Validate the editable resource contract before sending it to the API. */
export function validateResourceYaml(
	yamlContent: string,
	name: string,
	namespace: string
): string | null {
	try {
		const parsed = yaml.load(yamlContent);
		if (!parsed || typeof parsed !== 'object') {
			return 'Invalid YAML: must be a valid Kubernetes resource object';
		}

		const resource = parsed as K8sResource;
		if (!resource.apiVersion || !resource.kind || !resource.metadata) {
			return 'Invalid resource: missing required fields (apiVersion, kind, metadata)';
		}
		if (resource.metadata.name !== name) {
			return `Resource name mismatch: expected "${name}", got "${resource.metadata.name}"`;
		}
		if (resource.metadata.namespace && resource.metadata.namespace !== namespace) {
			return `Namespace mismatch: expected "${namespace}", got "${resource.metadata.namespace}"`;
		}
	} catch (error) {
		return error instanceof Error ? error.message : 'Invalid YAML syntax';
	}

	return null;
}

/** Extract the stable error text returned by the Flux update endpoint. */
export async function getResourceUpdateError(response: Response): Promise<string> {
	let errorMessage = `Failed to update resource: ${response.statusText}`;
	const body = await response.text().catch(() => '');
	if (!body) return errorMessage;

	try {
		const data = JSON.parse(body) as { error?: string; message?: string } | null;
		if (data && typeof data === 'object') {
			return data.error || data.message || errorMessage;
		}
	} catch {
		// Non-JSON response bodies are valid fallback error messages.
	}

	return body;
}
