export function getTabTargetIndex(key: string, index: number, tabCount: number): number | null {
	if (key === 'ArrowRight') return (index + 1) % tabCount;
	if (key === 'ArrowLeft') return (index - 1 + tabCount) % tabCount;
	if (key === 'Home') return 0;
	if (key === 'End') return tabCount - 1;
	return null;
}
