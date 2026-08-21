import { parse } from 'yaml';
import safeRegex from 'safe-regex2';
import type { ResourceTemplate, TemplateField } from '$lib/templates';
import { logger } from '$lib/utils/logger.js';

export function coerceWizardFieldValue(field: TemplateField, value: unknown): unknown {
	if (field.type !== 'number') return value;
	if (value === '' || value === null || value === undefined) return undefined;
	if (typeof value === 'number') return Number.isFinite(value) ? value : undefined;
	if (typeof value === 'string') {
		const parsedValue = Number(value);
		return Number.isFinite(parsedValue) ? parsedValue : undefined;
	}
	return undefined;
}

export function validateWizardField(
	field: TemplateField,
	value: unknown,
	visible: boolean
): string | null {
	if (!visible) return null;
	if (field.required && (value === undefined || value === null || value === '')) {
		return `${field.label} is required`;
	}
	if (!value) return null;

	if (field.validation?.pattern && typeof value === 'string') {
		try {
			if (!safeRegex(field.validation.pattern))
				return `Invalid validation pattern for ${field.label}`;
			if (!new RegExp(field.validation.pattern).test(value)) {
				return field.validation.message || `Invalid format for ${field.label}`;
			}
		} catch {
			return `Invalid validation pattern for ${field.label}`;
		}
	}

	if (field.type === 'number' && typeof value === 'number') {
		if (field.validation?.min !== undefined && value < field.validation.min) {
			return `${field.label} must be at least ${field.validation.min}`;
		}
		if (field.validation?.max !== undefined && value > field.validation.max) {
			return `${field.label} must be at most ${field.validation.max}`;
		}
	}

	return null;
}

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
