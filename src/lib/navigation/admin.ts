export interface AdminNavigationLink {
	label: string;
	href: string;
	icon: string;
	description: string;
	color: string;
	bg: string;
}

export const ADMIN_SIDEBAR_LINKS: AdminNavigationLink[] = [
	{
		label: 'Settings',
		href: '/admin/settings',
		icon: 'settings',
		description: 'Review application settings and runtime configuration.',
		color: 'text-primary',
		bg: 'bg-primary/10'
	},
	{
		label: 'Clusters',
		href: '/admin/clusters',
		icon: 'server',
		description: 'Configure and test Kubernetes cluster contexts.',
		color: 'text-amber-500',
		bg: 'bg-amber-500/10'
	},
	{
		label: 'Auth Providers',
		href: '/admin/auth-providers',
		icon: 'key',
		description: 'Manage local login, SSO, and OAuth providers.',
		color: 'text-primary',
		bg: 'bg-primary/10'
	},
	{
		label: 'Policies',
		href: '/admin/policies',
		icon: 'shield-check',
		description: 'Define RBAC and access control policies.',
		color: 'text-primary',
		bg: 'bg-primary/10'
	},
	{
		label: 'Audit Logs',
		href: '/admin/audit-logs',
		icon: 'history',
		description: 'Inspect security events and administrative changes.',
		color: 'text-primary',
		bg: 'bg-primary/10'
	},
	{
		label: 'Backups',
		href: '/admin/backups',
		icon: 'hard-drive',
		description: 'Create, restore, and validate backup workflows.',
		color: 'text-primary',
		bg: 'bg-primary/10'
	},
	{
		label: 'Users',
		href: '/admin/users',
		icon: 'users',
		description: 'Manage users, roles, and access assignments.',
		color: 'text-primary',
		bg: 'bg-primary/10'
	}
];

export const ADMIN_HOME_FEATURES: AdminNavigationLink[] = [
	ADMIN_SIDEBAR_LINKS[1],
	{
		label: 'Application Settings',
		href: '/admin/settings',
		icon: 'settings',
		description:
			'Review deployment defaults, runtime settings, and recovery-critical configuration.',
		color: 'text-primary',
		bg: 'bg-primary/10'
	},
	ADMIN_SIDEBAR_LINKS[2],
	ADMIN_SIDEBAR_LINKS[5],
	ADMIN_SIDEBAR_LINKS[6],
	ADMIN_SIDEBAR_LINKS[3],
	ADMIN_SIDEBAR_LINKS[4]
];

export function isAdminRole(role?: string | null): boolean {
	return role === 'admin';
}

export function getAdminSidebarLinks(role?: string | null): AdminNavigationLink[] {
	return isAdminRole(role) ? ADMIN_SIDEBAR_LINKS : [];
}
