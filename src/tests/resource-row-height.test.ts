import { describe, expect, test } from 'vitest';
import { getResourceTableRowHeight } from '../lib/components/flux/resource-row-height.js';

describe('getResourceTableRowHeight', () => {
	test('uses the offset delta when two rows are rendered', () => {
		expect(
			getResourceTableRowHeight([
				{ offsetTop: 10, offsetHeight: 40 },
				{ offsetTop: 67, offsetHeight: 40 }
			])
		).toBe(57);
	});

	test('uses a single non-zero row height', () => {
		expect(getResourceTableRowHeight([{ offsetTop: 10, offsetHeight: 42 }])).toBe(42);
	});

	test('does not update when there is no usable measurement', () => {
		expect(getResourceTableRowHeight([])).toBeUndefined();
		expect(getResourceTableRowHeight([{ offsetTop: 10, offsetHeight: 0 }])).toBeUndefined();
	});
});
