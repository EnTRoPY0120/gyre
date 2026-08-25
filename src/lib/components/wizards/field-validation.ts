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

function validatePattern(field: TemplateField, value: string): string | null {
	const pattern = field.validation?.pattern;
	if (!pattern) return null;

	try {
		if (!safeRegex(pattern)) return `Invalid validation pattern for ${field.label}`;
		if (!new RegExp(pattern).test(value)) {
			return field.validation?.message || `Invalid format for ${field.label}`;
		}
	} catch {
		return `Invalid validation pattern for ${field.label}`;
	}

	return null;
}

function validateNumberRange(field: TemplateField, value: number): string | null {
	const validation = field.validation;
	if (validation?.min !== undefined && value < validation.min) {
		return `${field.label} must be at least ${validation.min}`;
	}
	if (validation?.max !== undefined && value > validation.max) {
		return `${field.label} must be at most ${validation.max}`;
	}
	return null;
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
		const patternError = validatePattern(field, value);
		if (patternError) return patternError;
	}

	if (field.type === 'number' && typeof value === 'number') {
		return validateNumberRange(field, value);
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
