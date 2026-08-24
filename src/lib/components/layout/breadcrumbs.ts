import { getResourceInfo } from '$lib/config/resources';

export interface Breadcrumb {
	label: string;
	href: string;
}

const ADMIN_LABELS: Record<string, string> = {
	users: 'Users',
	clusters: 'Clusters',
	'auth-providers': 'Auth Providers',
	policies: 'Policies'
};

/** Build the compact breadcrumb trail used by the application header. */
export function buildBreadcrumbs(pathname: string): Breadcrumb[] {
	const parts = pathname.split('/').filter(Boolean);
	if (parts.length === 0) return [{ label: 'Dashboard', href: '/' }];

	const breadcrumbs: Breadcrumb[] = [{ label: 'Dashboard', href: '/' }];
	const [section, type, namespace, name] = parts;

	if (section === 'resources' && type) {
		const resourceInfo = getResourceInfo(type);
		breadcrumbs.push({
			label: resourceInfo?.displayName || type,
			href: `/resources/${type}`
		});
		if (namespace && name) {
			breadcrumbs.push({
				label: `${namespace}/${name}`,
				href: `/resources/${type}/${namespace}/${name}`
			});
		}
	} else if (section === 'admin') {
		breadcrumbs.push({ label: 'Administration', href: '/admin' });
		if (type) {
			breadcrumbs.push({
				label: ADMIN_LABELS[type] || type,
				href: `/admin/${type}`
			});
		}
	} else if (section === 'create') {
		breadcrumbs.push({ label: 'Create Resource', href: '/create' });
		if (type) breadcrumbs.push({ label: type, href: `/create/${type}` });
	} else if (section === 'change-password') {
		breadcrumbs.push({ label: 'Change Password', href: '/change-password' });
	}

	return breadcrumbs;
}
