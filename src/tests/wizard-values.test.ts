import { describe, expect, test } from 'vitest';
import {
	buildWizardFormValues,
	getWizardValueAtPath,
	inferVirtualFieldValue
} from '../lib/components/wizards/wizard-values.js';
import type { ResourceTemplate, TemplateField } from '../lib/templates/types.js';

const fields: TemplateField[] = [
	{
		name: 'gitBranch',
		label: 'Git branch',
		path: 'spec.ref.branch',
		type: 'string',
		showIf: { field: 'refType', value: 'branch' }
	},
	{
		name: 'gitTag',
		label: 'Git tag',
		path: 'spec.ref.tag',
		type: 'string',
		showIf: { field: 'refType', value: 'tag' }
	},
	{
		name: 'refType',
		label: 'Reference type',
		path: 'spec.refType',
		type: 'string',
		virtual: true
	}
];

const template: ResourceTemplate = {
	id: 'wizard-values-test',
	name: 'Wizard values test',
	description: '',
	kind: 'TestResource',
	group: 'test.example.io',
	version: 'v1',
	plural: 'testresources',
	yaml: '',
	fields: [
		{
			name: 'namespace',
			label: 'Namespace',
			path: 'metadata.namespace',
			type: 'string'
		},
		...fields,
		{
			name: 'fallback',
			label: 'Fallback',
			path: 'spec.fallback',
			type: 'string',
			virtual: true,
			default: 'default-value'
		}
	]
};

describe('getWizardValueAtPath', () => {
	test('walks nested values and returns undefined for missing branches', () => {
		const source = { spec: { ref: { branch: 'main' } } };
		expect(getWizardValueAtPath(source, 'spec.ref.branch')).toBe('main');
		expect(getWizardValueAtPath(source, 'spec.ref.tag')).toBeUndefined();
		expect(getWizardValueAtPath({ spec: null }, 'spec.ref.branch')).toBeUndefined();
	});
});

describe('inferVirtualFieldValue', () => {
	test('selects the controlling option with a populated manifest value', () => {
		expect(inferVirtualFieldValue(fields[2], fields, { spec: { ref: { tag: 'v1.2.3' } } })).toBe(
			'tag'
		);
	});

	test('returns undefined when no conditional field is populated', () => {
		expect(inferVirtualFieldValue(fields[2], fields, { spec: { ref: {} } })).toBeUndefined();
	});
});

describe('buildWizardFormValues', () => {
	test('applies namespace defaults and infers virtual fields from the manifest', () => {
		const values = buildWizardFormValues(
			template,
			{ metadata: {}, spec: { ref: { tag: 'v1.2.3' } } },
			'flux-system'
		);

		expect(values).toMatchObject({
			namespace: 'flux-system',
			refType: 'tag',
			fallback: 'default-value'
		});
	});
});
