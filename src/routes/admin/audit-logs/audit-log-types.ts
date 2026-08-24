export interface AuditLog {
	id: string;
	userId: string | null;
	action: string;
	resourceType: string | null;
	resourceName: string | null;
	namespace: string | null;
	clusterId: string | null;
	details: Record<string, unknown> | null;
	success: boolean;
	ipAddress: string | null;
	createdAt: Date;
	user: {
		username: string;
		email: string | null;
	} | null;
}
