export interface ResourceTableRowMeasurement {
	offsetHeight: number;
	offsetTop: number;
}

export function getResourceTableRowHeight(
	rows: ArrayLike<ResourceTableRowMeasurement>
): number | undefined {
	if (rows.length >= 2) return rows[1].offsetTop - rows[0].offsetTop;
	if (rows.length === 1 && rows[0].offsetHeight > 0) return rows[0].offsetHeight;
	return undefined;
}
