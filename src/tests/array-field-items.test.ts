import { describe, expect, test, vi } from 'vitest';
import { synchronizeArrayFieldItems } from '../lib/components/wizards/array-field-items.js';

describe('synchronizeArrayFieldItems', () => {
	test('preserves IDs for unchanged values and creates IDs for new positions', () => {
		const createId = vi.fn().mockReturnValueOnce('generated-1').mockReturnValueOnce('generated-2');
		const result = synchronizeArrayFieldItems(
			['same', 'new'],
			[{ id: 'stable', val: 'same' }],
			createId
		);

		expect(result).toEqual([
			{ id: 'stable', val: 'same' },
			{ id: 'generated-1', val: 'new' }
		]);
		expect(createId).toHaveBeenCalledTimes(1);
	});

	test('reuses an existing position ID when its value changes', () => {
		expect(
			synchronizeArrayFieldItems(
				[{ name: 'updated' }],
				[{ id: 'stable', val: { name: 'old' } }],
				() => 'unused'
			)
		).toEqual([{ id: 'stable', val: { name: 'updated' } }]);
	});
});
