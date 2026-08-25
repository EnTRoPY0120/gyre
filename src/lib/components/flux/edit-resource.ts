import * as yaml from 'js-yaml';
import type { K8sResource } from '$lib/types/kubernetes';

export interface UpdateResourceOptions {
	resourceType: string;
	namespace: string;
	name: string;
	yamlContent: string;
	csrfToken: string;
	fetcher?: typeof fetch;
}

interface SaveResourceEditOptions extends UpdateResourceOptions {
	validationErrors: ReadonlyArray<{ severity: number }>;
	afterSave: () => void | Promise<void>;
	updater?: (options: UpdateResourceOptions) => Promise<void>;
}

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

/** Persist an edited Flux resource through the resource update endpoint. */
export async function updateResource({
	resourceType,
	namespace,
	name,
	yamlContent,
	csrfToken,
	fetcher = fetch
}: UpdateResourceOptions): Promise<void> {
	const response = await fetcher(
		`/api/v1/flux/${encodeURIComponent(resourceType)}/${encodeURIComponent(namespace)}/${encodeURIComponent(name)}`,
		{
			method: 'PUT',
			headers: {
				'Content-Type': 'application/json',
				'X-CSRF-Token': csrfToken
			},
			body: JSON.stringify({ yaml: yamlContent })
		}
	);

	if (!response.ok) {
		throw new Error(await getResourceUpdateError(response));
	}
}

/** Validate and persist an edit, then run the modal's successful-save lifecycle. */
export async function saveResourceEdit({
	validationErrors,
	afterSave,
	updater = updateResource,
	...request
}: SaveResourceEditOptions): Promise<string | null> {
	const resourceError = validateResourceYaml(request.yamlContent, request.name, request.namespace);
	if (resourceError) return resourceError;
	if (validationErrors.some((marker) => marker.severity === 8)) {
		return 'Please fix YAML syntax errors before saving';
	}

	await updater(request);
	await afterSave();
	return null;
}
