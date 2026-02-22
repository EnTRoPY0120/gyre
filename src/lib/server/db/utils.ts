import { type SQL, count, and, desc } from 'drizzle-orm';
import type { SQLiteTable } from 'drizzle-orm/sqlite-core';
import { getDb } from './index.js';

export interface PaginationOptions {
	search?: string;
	limit?: number;
	offset?: number;
}

export interface PaginatedResult<T> {
	items: T[];
	total: number;
}

/**
 * Generic helper for paginated queries with search support.
 *
 * @param table - Drizzle table schema (e.g., users, clusters)
 * @param queryFn - Function that returns the db.query.table object (e.g. (db) => db.query.users)
 * @param options - Pagination options (search, limit, offset)
 * @param searchBuilder - Callback to build search conditions (e.g. (search) => or(like(...), like(...)))
 * @param orderByBuilder - Optional callback for sort order (default: desc(createdAt))
 */
export async function getPaginatedItems<T extends SQLiteTable, R>(
	table: T,
	queryFn: (db: Awaited<ReturnType<typeof getDb>>) => any,
	options: PaginationOptions = {},
	searchBuilder?: (search: string) => SQL | undefined,
	orderByBuilder?: (table: T) => SQL | SQL[]
): Promise<PaginatedResult<R>> {
	const db = await getDb();
	const { search, limit = 10, offset = 0 } = options;

	// Build conditions
	const conditions: SQL[] = [];
	if (search && searchBuilder) {
		const searchCondition = searchBuilder(search);
		if (searchCondition) {
			conditions.push(searchCondition);
		}
	}

	const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

	// Get total count
	const [{ value: total }] = await db.select({ value: count() }).from(table).where(whereClause);

	// Get paginated results
	const items = await queryFn(db).findMany({
		where: whereClause,
		orderBy: orderByBuilder ? orderByBuilder(table) : [desc((table as any).createdAt)],
		limit,
		offset
	});

	return { items, total };
}
