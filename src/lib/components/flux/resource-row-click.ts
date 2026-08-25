export function isResourceSelectionTarget(target: EventTarget | null): boolean {
	const element = target instanceof HTMLElement ? target : null;
	return (
		(element instanceof HTMLInputElement && element.type === 'checkbox') ||
		Boolean(element?.closest('input[type="checkbox"]'))
	);
}
