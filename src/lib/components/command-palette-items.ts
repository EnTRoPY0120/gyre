import type { ResourceGroup } from '$lib/types/flux';
import type { CommandItem } from './CommandPaletteTypes';

const RESOURCE_ICONS: Record<string, string> = {
	gitrepositories: 'git-branch',
	helmrepositories: 'library',
	helmcharts: 'package',
	buckets: 'bucket',
	ocirepositories: 'cloud',
	kustomizations: 'file-cog',
	helmreleases: 'ship',
	alerts: 'shield-alert',
	providers: 'radio',
	receivers: 'activity'
};

export function getResourceIcon(type: string): string {
	return RESOURCE_ICONS[type] ?? 'file';
}

function getNavigationItems(canCreate: boolean): CommandItem[] {
	const items: CommandItem[] = [
		{
			id: 'nav-dashboard',
			label: 'Dashboard',
			description: 'View cluster overview and status',
			icon: 'dashboard',
			href: '/',
			category: 'Navigation'
		}
	];

	if (canCreate) {
		items.push({
			id: 'nav-create',
			label: 'Create Resource',
			description: 'Create a new FluxCD resource',
			icon: 'plus',
			href: '/create',
			category: 'Navigation',
			keywords: ['new', 'add']
		});
	}

	return items;
}

function getResourceItems(resourceGroups: ResourceGroup[]): CommandItem[] {
	return resourceGroups.flatMap((group) =>
		group.resources.map((resource) => ({
			id: `resource-${resource.type}`,
			label: resource.displayName,
			description: resource.description,
			icon: getResourceIcon(resource.type),
			href: `/resources/${resource.type}`,
			category: 'Resources',
			keywords: [group.name, resource.kind]
		}))
	);
}

function getAdminItems(): CommandItem[] {
	return [
		{
			id: 'admin-users',
			label: 'Manage Users',
			description: 'View and manage user accounts',
			icon: 'users',
			href: '/admin/users',
			category: 'Admin'
		},
		{
			id: 'admin-clusters',
			label: 'Manage Clusters',
			description: 'Configure multi-cluster access',
			icon: 'server',
			href: '/admin/clusters',
			category: 'Admin'
		},
		{
			id: 'admin-auth-providers',
			label: 'Auth Providers',
			description: 'Configure SSO and OAuth providers',
			icon: 'key',
			href: '/admin/auth-providers',
			category: 'Admin'
		},
		{
			id: 'admin-settings',
			label: 'Settings',
			description: 'Application settings and configuration',
			icon: 'settings',
			href: '/admin/settings',
			category: 'Admin'
		},
		{
			id: 'admin-policies',
			label: 'RBAC Policies',
			description: 'Manage role-based access control',
			icon: 'shield-check',
			href: '/admin/policies',
			category: 'Admin'
		}
	];
}

export function buildCommandItems(
	resourceGroups: ResourceGroup[],
	options: { isAdmin: boolean; canCreate: boolean }
): CommandItem[] {
	const items = [...getNavigationItems(options.canCreate), ...getResourceItems(resourceGroups)];
	return options.isAdmin ? [...items, ...getAdminItems()] : items;
}
