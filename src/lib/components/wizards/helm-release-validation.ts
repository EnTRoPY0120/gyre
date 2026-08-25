import { parse } from 'yaml';
import type { ResourceTemplate } from '$lib/templates';
import { logger } from '$lib/utils/logger.js';

/** Reject conflicting structured resource fields and HelmRelease values.resources. */
export function validateHelmReleaseResourceValues(
	template: ResourceTemplate,
	formValues: Record<string, unknown>
): string | null {
	if (template.kind !== 'HelmRelease') return null;

	const structuredResourceFields = [
		'resourceLimitsCpu',
		'resourceLimitsMemory',
		'resourceRequestsCpu',
		'resourceRequestsMemory'
	];
	if (!structuredResourceFields.some((fieldName) => Boolean(formValues[fieldName]))) return null;

	const values = formValues.values;
	if (!values) return null;

	try {
		const parsedValues =
			typeof values === 'string'
				? (parse(values) as Record<string, unknown> | null)
				: (values as Record<string, unknown>);
		if (
			parsedValues &&
			typeof parsedValues === 'object' &&
			!Array.isArray(parsedValues) &&
			'resources' in parsedValues
		) {
			return 'Remove resources from Values before using structured resource fields.';
		}
	} catch (error) {
		logger.warn(error, 'Failed to parse HelmRelease values while checking resource conflicts');
	}

	return null;
}
