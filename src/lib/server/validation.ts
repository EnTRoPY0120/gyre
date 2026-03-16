import { error } from '@sveltejs/kit';

// RFC 1123 DNS label: lowercase alphanumeric and hyphens, max 63 chars, no leading/trailing hyphens.
// Used for Kubernetes namespaces.
const K8S_NAME_REGEX = /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$/;

// RFC 1123 DNS subdomain: dot-separated DNS labels, max 253 chars total.
// Used for Kubernetes resource names (which allow dots, e.g. "my.resource.name").
const K8S_DNS_SUBDOMAIN_REGEX = /^[a-z0-9]([-a-z0-9]*[a-z0-9])?(\.[a-z0-9]([-a-z0-9]*[a-z0-9])?)*$/;

export function validateK8sNamespace(namespace: string): void {
	if (!K8S_NAME_REGEX.test(namespace)) {
		throw error(400, {
			message: `Invalid namespace: "${namespace}". Must be lowercase alphanumeric and hyphens, max 63 chars.`
		});
	}
}

export function validateK8sName(name: string): void {
	if (name.length > 253 || !K8S_DNS_SUBDOMAIN_REGEX.test(name)) {
		throw error(400, {
			message: `Invalid resource name: "${name}". Must be a valid DNS subdomain (lowercase alphanumeric, hyphens, dots), max 253 chars.`
		});
	}
}
