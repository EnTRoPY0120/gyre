import type { UserPreferences } from '$lib/types/user';

export const ADMIN_ONBOARDING_CHECKLIST_IDS = [
	'clusters',
	'settings',
	'auth-providers',
	'backups'
] as const;

export type AdminOnboardingChecklistId = (typeof ADMIN_ONBOARDING_CHECKLIST_IDS)[number];

export interface AdminOnboardingChecklistItem {
	readonly id: AdminOnboardingChecklistId;
	readonly title: string;
	readonly description: string;
	readonly href: string;
}

export const ADMIN_ONBOARDING_CHECKLIST_ITEMS: ReadonlyArray<AdminOnboardingChecklistItem> = [
	{
		id: 'clusters',
		title: 'Review cluster connectivity',
		description: 'Confirm Gyre can reach the Kubernetes API and load current contexts.',
		href: '/admin/clusters'
	},
	{
		id: 'settings',
		title: 'Review application settings',
		description: 'Verify runtime configuration and deployment defaults before wider rollout.',
		href: '/admin/settings'
	},
	{
		id: 'auth-providers',
		title: 'Review auth providers',
		description: 'Check local login, SSO, and external identity provider configuration.',
		href: '/admin/auth-providers'
	},
	{
		id: 'backups',
		title: 'Review backups / recovery',
		description: 'Make sure backup and restore paths are understood before you need them.',
		href: '/admin/backups'
	}
];

export function normalizeAdminChecklistCompletedItems(
	items: string[] | undefined
): AdminOnboardingChecklistId[] {
	if (!Array.isArray(items)) {
		return [];
	}

	const validIds = new Set<string>(ADMIN_ONBOARDING_CHECKLIST_IDS);
	return [
		...new Set(items.filter((item): item is AdminOnboardingChecklistId => validIds.has(item)))
	];
}

export function getAdminChecklistState(preferences?: UserPreferences | null) {
	const completedItems = normalizeAdminChecklistCompletedItems(
		preferences?.onboarding?.adminChecklistCompletedItems
	);
	const dismissed = preferences?.onboarding?.adminChecklistDismissed ?? false;
	const allCompleted = ADMIN_ONBOARDING_CHECKLIST_IDS.every((id) => completedItems.includes(id));

	return {
		completedItems,
		dismissed,
		allCompleted,
		isHidden: dismissed || allCompleted
	};
}
