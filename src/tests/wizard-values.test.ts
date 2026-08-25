import { describe, expect, test, vi } from 'vitest';
import {
	buildWizardFormValues,
	getWizardValueAtPath,
	inferVirtualFieldValue,
	mergeWizardFormValues
} from '../lib/components/wizards/wizard-values.js';
import {
	getWizardYamlError,
	removeEmptyWizardFieldValue
} from '../lib/components/wizards/wizard-yaml.js';
import type { ResourceTemplate, TemplateField } from '../lib/templates/types.js';
import { parseDocument } from 'yaml';

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

describe('mergeWizardFormValues', () => {
	test('updates concrete values and preserves virtual defaults', () => {
		const values = mergeWizardFormValues(
			template,
			{ metadata: {}, spec: { ref: { branch: 'main' } } },
			{ fallback: undefined, untouched: 'keep' }
		);

		expect(values).toMatchObject({
			gitBranch: 'main',
			refType: 'branch',
			fallback: 'default-value'
		});
		expect(values.untouched).toBe('keep');
	});
});

describe('wizard YAML policies', () => {
	test('formats YAML parser errors for the editor', () => {
		const document = parseDocument('[');
		const yamlError = document.errors[0];
		expect(getWizardYamlError(yamlError)).toMatch(/^YAML Syntax Error:/);
		expect(getWizardYamlError(new Error('other'))).toBe('Invalid YAML syntax');
	});

	test('removes optional verification and numeric fields when empty', () => {
		const doc = { deleteIn: vi.fn() };
		const verifyField = {
			name: 'verifyMode',
			path: 'spec.verify.mode',
			type: 'string'
		} as TemplateField;
		const numberField = {
			name: 'replicas',
			path: 'spec.replicas',
			type: 'number'
		} as TemplateField;

		expect(removeEmptyWizardFieldValue(doc, verifyField, '')).toBe(true);
		expect(removeEmptyWizardFieldValue(doc, numberField, undefined)).toBe(true);
		expect(doc.deleteIn).toHaveBeenNthCalledWith(1, ['spec', 'verify']);
		expect(doc.deleteIn).toHaveBeenNthCalledWith(2, ['spec', 'replicas']);
		expect(removeEmptyWizardFieldValue(doc, numberField, 2)).toBe(false);
	});
});
