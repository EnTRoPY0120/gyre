import { YAMLError } from 'yaml';
import type { TemplateField } from '$lib/templates';

export interface WizardYamlDocument {
	deleteIn(path: string[]): unknown;
}

export function getWizardYamlError(error: unknown): string {
	return error instanceof YAMLError ? `YAML Syntax Error: ${error.message}` : 'Invalid YAML syntax';
}

export function removeEmptyWizardFieldValue(
	doc: WizardYamlDocument,
	field: TemplateField,
	value: unknown
): boolean {
	const path = field.path.split('.');
	if (field.name === 'verifyMode' && value === '') {
		doc.deleteIn(path.slice(0, -1));
		return true;
	}
	if (field.type === 'number' && value === undefined) {
		doc.deleteIn(path);
		return true;
	}
	return false;
}
