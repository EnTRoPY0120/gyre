export interface ResourceTemplate {
	id: string;
	name: string;
	description: string;
	kind: string;
	group: string;
	version: string;
	yaml: string;
	fields: TemplateField[];
	sections?: TemplateSection[];
	category?: string; // Added for categorization
	plural: string; // API plural form (e.g., 'gitrepositories', 'helmcharts')
}

export interface TemplateField {
	name: string;
	label: string;
	path: string; // JSON path or similar to update the YAML
	type: 'string' | 'number' | 'boolean' | 'select' | 'duration' | 'textarea' | 'array' | 'object';
	default?: string | number | boolean | unknown[];
	options?: { label: string; value: string }[];
	required?: boolean;
	description?: string;
	section?: string; // Section grouping for fields
	placeholder?: string;
	showIf?: {
		field: string; // Name of field to check
		value: string | string[]; // Value(s) that trigger visibility
	};
	validation?: {
		pattern?: string; // Regex pattern
		message?: string; // Custom error message
		min?: number; // Min value (for numbers)
		max?: number; // Max value (for numbers)
	};
	arrayItemType?: 'string' | 'object'; // For array fields
	arrayItemFields?: TemplateField[]; // For object array items
	objectFields?: TemplateField[]; // For object fields
	helpText?: string; // Detailed help text for the field
	docsUrl?: string; // Link to FluxCD documentation
	virtual?: boolean; // UI-only field, do not persist to YAML
	referenceType?: string | string[]; // Resource type(s) to autocomplete from
	referenceTypeField?: string; // Field to get the reference type from
	referenceNamespaceField?: string; // Sibling field to auto-fill with selected namespace
}

export interface TemplateSection {
	id: string;
	title: string;
	description?: string;
	collapsible?: boolean;
	defaultExpanded?: boolean;
}

export const CEL_VALIDATION = {
	pattern: '^[\\s\\S]{1,500}$',
	message: 'CEL expression must be 500 characters or fewer.'
};
