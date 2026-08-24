import { describe, expect, test } from 'vitest';
import { getReferenceDisplayValue } from '../lib/components/wizards/reference-display.js';

const base = {
	placeholder: 'Select resource...',
	selectedResource: null,
	selectedKey: null,
	selectedLabel: '',
	referenceNamespace: ''
};

describe('getReferenceDisplayValue', () => {
	test('uses the placeholder for an empty value', () => {
		expect(getReferenceDisplayValue({ ...base, value: '' })).toBe('Select resource...');
	});

	test('prefers the selected resource label', () => {
		expect(
			getReferenceDisplayValue({
				...base,
				value: 'app',
				selectedResource: {
					key: 'GitRepository:flux-system:app',
					name: 'app',
					namespace: 'flux-system',
					label: 'GitRepository / flux-system / app',
					searchText: 'app'
				}
			})
		).toBe('GitRepository / flux-system / app');
	});

	test('uses a selected key label when the fetched resource is unavailable', () => {
		expect(
			getReferenceDisplayValue({
				...base,
				value: 'app',
				selectedKey: 'GitRepository:flux-system:app',
				selectedLabel: 'GitRepository / flux-system / app',
				referenceNamespace: 'flux-system'
			})
		).toBe('GitRepository / flux-system / app');
	});

	test('falls back to the name and namespace', () => {
		expect(
			getReferenceDisplayValue({ ...base, value: 'app', referenceNamespace: 'flux-system' })
		).toBe('app (flux-system)');
	});
});
