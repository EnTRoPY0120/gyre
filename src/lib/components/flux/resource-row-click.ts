export function isResourceRowInteractiveTarget(target: EventTarget | null): boolean {
	const element = target instanceof Element ? target : null;
	return Boolean(element?.closest('a, input[type="checkbox"]'));
}
