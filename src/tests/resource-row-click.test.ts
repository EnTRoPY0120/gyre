import { describe, expect, test } from 'vitest';
import { isResourceRowInteractiveTarget } from '../lib/components/flux/resource-row-click.js';

describe('isResourceRowInteractiveTarget', () => {
	test('recognizes links and checkbox inputs directly or through their children', () => {
		const checkbox = document.createElement('input');
		checkbox.type = 'checkbox';
		const link = document.createElement('a');
		const linkText = document.createElement('span');
		link.append(linkText);
		const textInput = document.createElement('input');
		textInput.type = 'text';

		expect(isResourceRowInteractiveTarget(checkbox)).toBe(true);
		expect(isResourceRowInteractiveTarget(link)).toBe(true);
		expect(isResourceRowInteractiveTarget(linkText)).toBe(true);
		expect(isResourceRowInteractiveTarget(textInput)).toBe(false);
	});

	test('allows ordinary element targets and non-element events', () => {
		const row = document.createElement('tr');
		const nestedText = document.createElement('span');
		row.append(nestedText);
		const text = document.createTextNode('resource');

		expect(isResourceRowInteractiveTarget(row)).toBe(false);
		expect(isResourceRowInteractiveTarget(nestedText)).toBe(false);
		expect(isResourceRowInteractiveTarget(text)).toBe(false);
		expect(isResourceRowInteractiveTarget(null)).toBe(false);
	});
});
