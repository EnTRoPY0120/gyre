import { error } from '@sveltejs/kit';

// RFC 1123: lowercase alphanumeric and hyphens, max 63 chars, no leading/trailing hyphens
// Single-char names (e.g. "a") are valid; zero-length is not.
const K8S_NAME_REGEX = /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$/;

export function validateK8sNamespace(namespace: string): void {
	if (!K8S_NAME_REGEX.test(namespace)) {
		throw error(400, {
			message: `Invalid namespace: "${namespace}". Must be lowercase alphanumeric and hyphens, max 63 chars.`
		});
	}
}

export function validateK8sName(name: string): void {
	if (!K8S_NAME_REGEX.test(name)) {
		throw error(400, {
			message: `Invalid resource name: "${name}". Must be lowercase alphanumeric and hyphens, max 63 chars.`
		});
	}
}
