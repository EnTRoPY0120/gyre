import { describe, expect, test } from 'vitest';
import { isResourceSelectionTarget } from '../lib/components/flux/resource-row-click.js';

describe('isResourceSelectionTarget', () => {
	test('recognizes checkbox inputs directly', () => {
		const checkbox = document.createElement('input');
		checkbox.type = 'checkbox';
		const textInput = document.createElement('input');
		textInput.type = 'text';

		expect(isResourceSelectionTarget(checkbox)).toBe(true);
		expect(isResourceSelectionTarget(textInput)).toBe(false);
	});

	test('allows ordinary element targets and non-element events', () => {
		const row = document.createElement('tr');
		const nestedText = document.createElement('span');
		row.append(nestedText);
		const text = document.createTextNode('resource');

		expect(isResourceSelectionTarget(row)).toBe(false);
		expect(isResourceSelectionTarget(nestedText)).toBe(false);
		expect(isResourceSelectionTarget(text)).toBe(false);
		expect(isResourceSelectionTarget(null)).toBe(false);
	});
});
