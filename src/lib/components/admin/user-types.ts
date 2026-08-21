export interface User {
	id: string;
	username: string;
	email: string | null;
	role: 'admin' | 'editor' | 'viewer';
	active: boolean;
	isLocal: boolean;
	createdAt: Date;
	updatedAt: Date;
}
