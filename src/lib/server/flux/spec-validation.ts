// CEL expressions accepted by Flux health checks.
export const CEL_PATTERN = /^[a-zA-Z0-9_.()[\]"' !&|=<>+\-*/%?:,\n\r\t]{1,500}$/;

// Kubernetes label and Flux substitution variable formats.
export const LABEL_KEY_PATTERN =
	/^([a-z0-9]([a-z0-9\-.]*)?[a-z0-9]?\/)?[a-zA-Z0-9]([a-zA-Z0-9\-._]{0,61}[a-zA-Z0-9])?$/;

export const LABEL_VALUE_PATTERN = /^[a-zA-Z0-9]([a-zA-Z0-9\-._]{0,61}[a-zA-Z0-9])?$|^$/;

export const SUBSTITUTE_VAR_PATTERN = /^[a-zA-Z_][a-zA-Z0-9_]*$/;

export function validateLabelMap(labels: unknown): string | null {
	if (labels === null || labels === undefined) {
		return null;
	}

	if (typeof labels === 'string') {
		if (labels.trim() === '') {
			return 'Invalid labels: empty string is not allowed';
		}
		return 'Labels must be an object';
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
	if (vars === null || vars === undefined) {
		return null;
	}

	if (typeof vars === 'string') {
		if (vars.trim() === '') {
			return 'Invalid substitute variables: empty string is not allowed';
		}
		return 'Substitute variables must be an object';
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

type HealthCheckExpression = Record<string, unknown>;

function validateCelField(
	expression: HealthCheckExpression,
	field: 'inProgress' | 'failed' | 'current'
): string | null {
	const value = expression[field];
	if (value !== undefined && typeof value !== 'string') {
		return `healthCheckExprs.${field} must be a string`;
	}
	if (value && typeof value === 'string' && !CEL_PATTERN.test(value)) {
		return `Invalid CEL expression in healthCheckExprs.${field}`;
	}
	return null;
}

function validateHealthCheckExpressions(expressions: unknown): string | null {
	if (!expressions || !Array.isArray(expressions)) {
		return null;
	}

	for (const expression of expressions) {
		if (!expression || typeof expression !== 'object') {
			return 'Invalid healthCheckExprs item: must be a non-null object';
		}

		const expressionObject = expression as HealthCheckExpression;
		for (const field of ['inProgress', 'failed', 'current'] as const) {
			const fieldError = validateCelField(expressionObject, field);
			if (fieldError) {
				return fieldError;
			}
		}
	}

	return null;
}

function validateCommonMetadata(spec: Record<string, unknown>): string | null {
	const commonMetadata = spec.commonMetadata as Record<string, unknown> | undefined;
	if (!commonMetadata) {
		return null;
	}
	return validateLabelMap(commonMetadata.labels);
}

function validateKustomizationSpec(spec: Record<string, unknown>): string | null {
	return (
		validateHealthCheckExpressions(spec.healthCheckExprs) ??
		validateCommonMetadata(spec) ??
		validateSubstituteVars((spec.postBuild as Record<string, unknown> | undefined)?.substitute)
	);
}

function validateHelmReleaseSpec(spec: Record<string, unknown>): string | null {
	return validateCommonMetadata(spec);
}

/**
 * Validates FluxCD resource spec fields that accept user input.
 *
 * Kustomization supports CEL expressions in healthCheckExprs, labels in
 * commonMetadata.labels, and substitution variables in postBuild.substitute.
 * HelmRelease supports labels in commonMetadata.labels. Other FluxCD resource
 * types do not accept these fields and return null.
 */
export function validateFluxResourceSpec(
	resourceType: string,
	spec: Record<string, unknown>
): string | null {
	if (!spec) {
		return null;
	}

	if (resourceType === 'Kustomization') {
		return validateKustomizationSpec(spec);
	}

	if (resourceType === 'HelmRelease') {
		return validateHelmReleaseSpec(spec);
	}

	return null;
}
