import type { ResourceTemplate, TemplateField } from '$lib/templates';
import { coerceWizardFieldValue } from './field-validation';

export function getWizardValueAtPath(source: Record<string, unknown>, path: string): unknown {
	let current: unknown = source;
	for (const segment of path.split('.')) {
		if (!current || typeof current !== 'object') return undefined;
		current = (current as Record<string, unknown>)[segment];
	}
	return current;
}

function hasPopulatedValue(value: unknown): boolean {
	return (
		value !== undefined &&
		value !== null &&
		value !== '' &&
		(!Array.isArray(value) || value.length > 0)
	);
}

function getInitialFieldValue(
	field: TemplateField,
	fields: TemplateField[],
	source: Record<string, unknown>,
	defaultNamespace?: string
): unknown {
	let value = coerceWizardFieldValue(field, getWizardValueAtPath(source, field.path));

	if (field.name === 'namespace' && defaultNamespace) {
		value = defaultNamespace;
	}

	if (!field.virtual) {
		return value;
	}

	const manifestValue = inferVirtualFieldValue(field, fields, source);
	if (manifestValue !== undefined) {
		return manifestValue;
	}

	return value === undefined ? field.default : value;
}

/** Build the wizard's initial form state from the template manifest. */
export function buildWizardFormValues(
	template: ResourceTemplate,
	source: Record<string, unknown>,
	defaultNamespace?: string
): Record<string, unknown> {
	const values: Record<string, unknown> = {};

	for (const field of template.fields) {
		values[field.name] = getInitialFieldValue(field, template.fields, source, defaultNamespace);
	}

	return values;
}

/** Merge values parsed from edited YAML into the current wizard form state. */
export function mergeWizardFormValues(
	template: ResourceTemplate,
	source: Record<string, unknown>,
	currentValues: Record<string, unknown>
): Record<string, unknown> {
	const values: Record<string, unknown> = { ...currentValues };

	for (const field of template.fields) {
		if (field.virtual) {
			const manifestValue = inferVirtualFieldValue(field, template.fields, source);
			if (manifestValue !== undefined) {
				values[field.name] = manifestValue;
			} else if (values[field.name] === undefined && field.default !== undefined) {
				values[field.name] = field.default;
			}
			continue;
		}

		values[field.name] = coerceWizardFieldValue(field, getWizardValueAtPath(source, field.path));
	}

	return values;
}

/** Infer a virtual selector from the first populated field that controls it. */
export function inferVirtualFieldValue(
	field: TemplateField,
	fields: TemplateField[],
	source: Record<string, unknown>
): string | undefined {
	for (const candidate of fields) {
		if (candidate.virtual || candidate.showIf?.field !== field.name) continue;
		if (!hasPopulatedValue(getWizardValueAtPath(source, candidate.path))) continue;

		const showIfValue = candidate.showIf.value;
		return Array.isArray(showIfValue) ? showIfValue[0] : showIfValue;
	}

	return undefined;
}
