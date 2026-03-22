import { error } from '@sveltejs/kit';

// RFC 1123 DNS label: lowercase alphanumeric and hyphens, max 63 chars, no leading/trailing hyphens.
// Used for Kubernetes namespaces.
export const K8S_NAME_REGEX = /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$/;

// RFC 1123 DNS subdomain: dot-separated DNS labels, max 253 chars total.
// Used for Kubernetes resource names (which allow dots, e.g. "my.resource.name").
export const K8S_DNS_SUBDOMAIN_REGEX =
	/^[a-z0-9]([-a-z0-9]*[a-z0-9])?(\.[a-z0-9]([-a-z0-9]*[a-z0-9])?)*$/;

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

// Strip control characters from a filename for safe storage/logging
export function sanitizeFilename(name: string): string {
	// eslint-disable-next-line no-control-regex
	return name.replace(/[\x00-\x1f\x7f]/g, '').slice(0, 255);
}

// Check that a backup filename has an allowed extension
export function isAllowedBackupExtension(name: string): boolean {
	return name.endsWith('.db') || name.endsWith('.db.enc');
}

// MIME types that legitimate SQLite backup files carry.
// Empty string is included because some browsers omit the MIME type entirely.
const ALLOWED_BACKUP_MIME_TYPES = new Set([
	'application/octet-stream',
	'application/x-sqlite3',
	''
]);

// Check that a MIME type is a recognised SQLite backup content type.
// Strips parameters (e.g. "; charset=utf-8"), normalises to lowercase
// (MIME types are case-insensitive per RFC 2045), and matches against
// the allowlist. Truly empty input (browser-omitted MIME) is allowed;
// whitespace-only input is rejected as malformed.
export function isAllowedBackupMimeType(mimeType: string): boolean {
	if (mimeType === '') return true;
	const trimmed = mimeType.trim();
	if (trimmed === '') return false;
	const mimeBase = trimmed.split(';')[0].toLowerCase();
	return ALLOWED_BACKUP_MIME_TYPES.has(mimeBase);
}
