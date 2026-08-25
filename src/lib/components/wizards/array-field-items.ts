export interface ArrayFieldItem {
	id: string;
	val: unknown;
}

export function synchronizeArrayFieldItems(
	value: unknown[],
	items: ArrayFieldItem[],
	createId: () => string
): ArrayFieldItem[] {
	return value.map((nextValue, index) => {
		const existingItem = items[index];
		if (existingItem && JSON.stringify(existingItem.val) === JSON.stringify(nextValue)) {
			return existingItem;
		}

		return {
			id: existingItem?.id || createId(),
			val: nextValue
		};
	});
}
