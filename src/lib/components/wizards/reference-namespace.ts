import type { TemplateField } from '$lib/templates';

export interface ReferenceNamespaceUpdate {
	fieldName: string;
	value: string;
	field?: TemplateField;
}

export function getReferenceNamespaceUpdate(
	field: Pick<TemplateField, 'referenceNamespaceField'>,
	selection: { namespace?: string } | undefined,
	fields: TemplateField[]
): ReferenceNamespaceUpdate | null {
	const fieldName = field.referenceNamespaceField;
	if (!fieldName || selection?.namespace === undefined) return null;

	return {
		fieldName,
		value: selection.namespace,
		field: fields.find((candidate) => candidate.name === fieldName)
	};
}
