export interface ShortcutResourceGroup {
	name: string;
	icon?: string;
	primaryRoute?: string;
}

export interface SystemShortcut {
	route: string;
	icon: string;
}

export function getSystemShortcut(
	groups: readonly ShortcutResourceGroup[],
	groupName: string,
	fallbackRoute: string,
	fallbackIcon: string
): SystemShortcut {
	const group = groups.find((candidate) => candidate.name === groupName);
	return {
		route: group?.primaryRoute ? `/resources/${group.primaryRoute}` : fallbackRoute,
		icon: group?.icon || fallbackIcon
	};
}
