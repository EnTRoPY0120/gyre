export function resolveReferenceTypes(
	referenceType: string | string[] | undefined,
	referenceTypeField: string | undefined,
	formValues: Record<string, unknown>
): string[] {
	if (referenceTypeField) {
		const typeFromField = formValues[referenceTypeField];
		return typeFromField ? [String(typeFromField)] : [];
	}
	if (Array.isArray(referenceType)) return referenceType;
	return referenceType ? [referenceType] : [];
}
