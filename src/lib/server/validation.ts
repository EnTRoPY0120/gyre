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

export const CEL_PATTERN = /^[a-zA-Z0-9_.()[\]"' !&|=<>+\-*/%?:,\n\r\t]{1,500}$/;

export const LABEL_KEY_PATTERN =
	/^([a-z0-9A-Z]([a-z0-9A-Z\-._]{0,61}[a-z0-9A-Z])?\/)?[a-zA-Z0-9]([a-zA-Z0-9\-._]{0,61}[a-zA-Z0-9])?$/;

export const LABEL_VALUE_PATTERN = /^[a-zA-Z0-9]([a-zA-Z0-9\-._]{0,61}[a-zA-Z0-9])?$|^$/;

export const SUBSTITUTE_VAR_PATTERN = /^[a-zA-Z_][a-zA-Z0-9_]*$/;

export function validateLabelMap(labels: unknown): string | null {
	if (labels === null || labels === undefined || labels === '') {
		return null;
	}

	if (typeof labels !== 'object') {
		return 'Labels must be an object';
	}

	if (Array.isArray(labels)) {
		return 'Labels must be an object, not an array';
	}

	const labelEntries = Object.entries(labels);
	for (const [key, value] of labelEntries) {
		if (!LABEL_KEY_PATTERN.test(key)) {
			return `Invalid label key "${key}": must be valid Kubernetes label key (max 63 chars per segment, alphanumeric with hyphens/underscores/dots)`;
		}
		if (typeof value !== 'string') {
			return `Label value for "${key}" must be a string`;
		}
		if (!LABEL_VALUE_PATTERN.test(value)) {
			return `Invalid label value for "${key}": must be alphanumeric with hyphens/underscores/dots, max 63 chars`;
		}
	}

	return null;
}

export function validateSubstituteVars(vars: unknown): string | null {
	if (vars === null || vars === undefined || vars === '') {
		return null;
	}

	if (typeof vars !== 'object') {
		return 'Substitute variables must be an object';
	}

	if (Array.isArray(vars)) {
		return 'Substitute variables must be an object, not an array';
	}

	const varEntries = Object.entries(vars);
	for (const [key, value] of varEntries) {
		if (!SUBSTITUTE_VAR_PATTERN.test(key)) {
			return `Invalid variable name "${key}": must start with letter or underscore, contain only alphanumeric and underscores`;
		}
		if (typeof value !== 'string') {
			return `Variable "${key}" value must be a string`;
		}
		if (value.length > 1000) {
			return `Variable "${key}" value exceeds maximum length of 1000 characters`;
		}
	}

	return null;
}

/**
 * Validates FluxCD resource spec fields that accept user input.
 *
 * Currently only validates Kustomization and HelmRelease because:
 * - Kustomization: supports CEL expressions in healthCheckExprs, labels in
 *   commonMetadata.labels, and substitution variables in postBuild.substitute
 * - HelmRelease: supports labels in commonMetadata.labels
 *
 * Other FluxCD resources (GitRepository, HelmRepository, HelmChart, Bucket,
 * OCIRepository, Alert, Provider, Receiver, etc.) do not accept CEL expressions,
 * label maps, or substitution variables in their specs, so they return null.
 */
export function validateFluxResourceSpec(
	resourceType: string,
	spec: Record<string, unknown>
): string | null {
	if (!spec) {
		return null;
	}

	if (resourceType === 'Kustomization') {
		const healthCheckExprs = spec.healthCheckExprs as Array<Record<string, unknown>> | undefined;
		if (healthCheckExprs && Array.isArray(healthCheckExprs)) {
			for (const expr of healthCheckExprs) {
				const inProgress = expr.inProgress as string | undefined;
				const failed = expr.failed as string | undefined;
				const current = expr.current as string | undefined;

				if (inProgress && !CEL_PATTERN.test(inProgress)) {
					return 'Invalid CEL expression in healthCheckExprs.inProgress';
				}
				if (failed && !CEL_PATTERN.test(failed)) {
					return 'Invalid CEL expression in healthCheckExprs.failed';
				}
				if (current && !CEL_PATTERN.test(current)) {
					return 'Invalid CEL expression in healthCheckExprs.current';
				}
			}
		}

		const commonMetadata = spec.commonMetadata as Record<string, unknown> | undefined;
		if (commonMetadata) {
			const labels = commonMetadata.labels;
			const labelError = validateLabelMap(labels);
			if (labelError) {
				return labelError;
			}
		}

		const postBuild = spec.postBuild as Record<string, unknown> | undefined;
		if (postBuild) {
			const substitute = postBuild.substitute;
			const subError = validateSubstituteVars(substitute);
			if (subError) {
				return subError;
			}
		}
	}

	if (resourceType === 'HelmRelease') {
		const commonMetadata = spec.commonMetadata as Record<string, unknown> | undefined;
		if (commonMetadata) {
			const labels = commonMetadata.labels;
			const labelError = validateLabelMap(labels);
			if (labelError) {
				return labelError;
			}
		}
	}

	return null;
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
	const mimeBase = trimmed.split(';')[0].trim().toLowerCase();
	return ALLOWED_BACKUP_MIME_TYPES.has(mimeBase);
}
