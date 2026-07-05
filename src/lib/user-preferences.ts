// Legacy onboarding checklist model retained for persisted preference compatibility.
// Dashboard readiness now uses live server-derived state instead.
function extractChecklistIds<const TItems extends ReadonlyArray<{ readonly id: string }>>(
	items: TItems
) {
	return items.map((item) => item.id) as {
		readonly [K in keyof TItems]: TItems[K] extends { readonly id: infer TId extends string }
			? TId
			: never;
	};
}

const ADMIN_ONBOARDING_CHECKLIST_ITEMS = [
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
] as const;

export const ADMIN_ONBOARDING_CHECKLIST_IDS = extractChecklistIds(ADMIN_ONBOARDING_CHECKLIST_ITEMS);
