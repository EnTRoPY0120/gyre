import type { TemplateField } from '$lib/templates';

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
