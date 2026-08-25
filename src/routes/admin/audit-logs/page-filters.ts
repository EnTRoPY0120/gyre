export interface AuditLogSearchItem {
	action: string;
	resourceName: string | null;
	resourceType: string | null;
	namespace: string | null;
	ipAddress: string | null;
	user: { username: string } | null;
}

/** Filter the loaded audit page across the fields exposed by the search box. */
export function filterAuditLogs<T extends AuditLogSearchItem>(logs: T[], query: string): T[] {
	if (!query) return logs;
	const normalizedQuery = query.toLowerCase();
	return logs.filter((log) =>
		[
			log.action,
			log.resourceName,
			log.resourceType,
			log.namespace,
			log.user?.username,
			log.ipAddress
		].some((value) => value?.toLowerCase().includes(normalizedQuery))
	);
}
