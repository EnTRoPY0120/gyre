export type AdminNavigationLinkId =
	| 'settings'
	| 'clusters'
	| 'auth-providers'
	| 'policies'
	| 'audit-logs'
	| 'backups'
	| 'users'
	| 'application-settings';

export interface AdminNavigationLink {
	id: AdminNavigationLinkId;
	label: string;
	href: string;
	icon: string;
	description: string;
	color: string;
	bg: string;
}

export const ADMIN_SIDEBAR_LINKS: ReadonlyArray<AdminNavigationLink> = [
	{
		id: 'settings',
		label: 'Settings',
		href: '/admin/settings',
		icon: 'settings',
		description: 'Review application settings and runtime configuration.',
		color: 'text-primary',
		bg: 'bg-primary/10'
	},
	{
		id: 'clusters',
		label: 'Clusters',
		href: '/admin/clusters',
		icon: 'server',
		description: 'Configure and test Kubernetes cluster contexts.',
		color: 'text-amber-500',
		bg: 'bg-amber-500/10'
	},
	{
		id: 'auth-providers',
		label: 'Auth Providers',
		href: '/admin/auth-providers',
		icon: 'key',
		description: 'Manage local login, SSO, and OAuth providers.',
		color: 'text-primary',
		bg: 'bg-primary/10'
	},
	{
		id: 'policies',
		label: 'Policies',
		href: '/admin/policies',
		icon: 'shield-check',
		description: 'Define RBAC and access control policies.',
		color: 'text-primary',
		bg: 'bg-primary/10'
	},
	{
		id: 'audit-logs',
		label: 'Audit Logs',
		href: '/admin/audit-logs',
		icon: 'history',
		description: 'Inspect security events and administrative changes.',
		color: 'text-primary',
		bg: 'bg-primary/10'
	},
	{
		id: 'backups',
		label: 'Backups',
		href: '/admin/backups',
		icon: 'hard-drive',
		description: 'Create, restore, and validate backup workflows.',
		color: 'text-primary',
		bg: 'bg-primary/10'
	},
	{
		id: 'users',
		label: 'Users',
		href: '/admin/users',
		icon: 'users',
		description: 'Manage users, roles, and access assignments.',
		color: 'text-primary',
		bg: 'bg-primary/10'
	}
];

function getAdminSidebarLinkById(id: AdminNavigationLinkId): AdminNavigationLink {
	const link = ADMIN_SIDEBAR_LINKS.find((item) => item.id === id);
	if (!link) {
		throw new Error(`Missing admin sidebar link for id: ${id}`);
	}

	return link;
}

export const ADMIN_HOME_FEATURES: ReadonlyArray<AdminNavigationLink> = [
	getAdminSidebarLinkById('clusters'),
	{
		id: 'application-settings',
		label: 'Application Settings',
		href: '/admin/settings',
		icon: 'settings',
		description:
			'Review deployment defaults, runtime settings, and recovery-critical configuration.',
		color: 'text-primary',
		bg: 'bg-primary/10'
	},
	getAdminSidebarLinkById('auth-providers'),
	getAdminSidebarLinkById('backups'),
	getAdminSidebarLinkById('users'),
	getAdminSidebarLinkById('policies'),
	getAdminSidebarLinkById('audit-logs')
];

// Keep this aligned with server-side `isAdmin(user)` in `src/lib/server/rbac.ts`.
export function isAdminRole(role?: string | null): boolean {
	return role === 'admin';
}

export function getAdminSidebarLinks(role?: string | null): AdminNavigationLink[] {
	return isAdminRole(role) ? [...ADMIN_SIDEBAR_LINKS] : [];
}
