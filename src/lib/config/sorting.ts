export const VALID_SORT_BY = ['name', 'age', 'status'] as const;
export type SortBy = (typeof VALID_SORT_BY)[number];

export const VALID_SORT_ORDER = ['asc', 'desc'] as const;
export type SortOrder = (typeof VALID_SORT_ORDER)[number];

/** Sort fields with display labels, in the order they should appear in the UI. */
export const SORT_FIELDS: { key: SortBy; label: string }[] = [
	{ key: 'name', label: 'Name' },
	{ key: 'age', label: 'Age' },
	{ key: 'status', label: 'Status' }
];
