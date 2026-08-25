import type { ReferenceOption } from './reference-fetch';

export function getReferenceDisplayValue(params: {
	value: string;
	placeholder: string;
	selectedResource: ReferenceOption | null;
	selectedKey: string | null;
	selectedLabel: string;
	referenceNamespace: string;
}): string {
	if (!params.value) return params.placeholder;
	if (params.selectedResource) return params.selectedResource.label;

	if (params.selectedKey) {
		const firstSeparator = params.selectedKey.indexOf(':');
		const secondSeparator = params.selectedKey.indexOf(':', firstSeparator + 1);
		const selectedName = params.selectedKey.slice(secondSeparator + 1);
		const selectedNamespace = params.selectedKey.slice(firstSeparator + 1, secondSeparator);
		if (
			selectedName === params.value &&
			(!params.referenceNamespace || selectedNamespace === params.referenceNamespace)
		) {
			return params.selectedLabel;
		}
	}

	return params.referenceNamespace
		? `${params.value} (${params.referenceNamespace})`
		: params.value;
}
