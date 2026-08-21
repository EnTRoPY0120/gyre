export interface Policy {
	id: string;
	name: string;
	description: string | null;
	role: 'admin' | 'editor' | 'viewer';
	action: 'read' | 'write' | 'admin';
	resourceType: string | null;
	namespacePattern: string | null;
	clusterId: string | null;
	isActive: boolean;
	createdAt: Date;
	updatedAt: Date;
}

export interface PolicyUser {
	id: string;
	username: string;
	role: 'admin' | 'editor' | 'viewer';
	active: boolean;
}
