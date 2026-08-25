import { and, asc, desc, eq } from 'drizzle-orm';
import { auditLogs } from './db/schema.js';

export type AuditLogSortBy = 'date' | 'action';
export type AuditLogSortOrder = 'asc' | 'desc';

export interface AuditLogQueryOptions {
	userId?: string;
	action?: string;
	success?: boolean;
	limit?: number;
	offset?: number;
	sortBy?: AuditLogSortBy;
	sortOrder?: AuditLogSortOrder;
}

export function buildAuditLogQuery(options: AuditLogQueryOptions) {
	const {
		userId,
		action,
		success,
		limit = 50,
		offset = 0,
		sortBy = 'date',
		sortOrder = 'desc'
	} = options;

	const conditions = [];
	if (userId) conditions.push(eq(auditLogs.userId, userId));
	if (action) conditions.push(eq(auditLogs.action, action));
	if (success !== undefined) conditions.push(eq(auditLogs.success, success));

	const whereClause = conditions.length > 0 ? and(...conditions) : undefined;
	const sortDir = sortOrder === 'asc' ? asc : desc;
	const orderBy =
		sortBy === 'action'
			? [sortDir(auditLogs.action), desc(auditLogs.createdAt)]
			: [sortDir(auditLogs.createdAt)];

	return { whereClause, orderBy, limit, offset };
}
