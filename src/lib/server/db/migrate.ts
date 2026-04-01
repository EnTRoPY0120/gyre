import { logger } from '../logger.js';
import { getDbSync } from './index.js';
import { sql } from 'drizzle-orm';
import { initAuthTables, type MigrationFlags } from './migrations/auth-tables.js';
import { initClusterTables } from './migrations/cluster-tables.js';
import { initRbacTables } from './migrations/rbac-tables.js';
import { initAuditTables } from './migrations/audit-tables.js';
import { initSecurityTables } from './migrations/security-tables.js';

/**
 * Initialize database tables
 * Creates all necessary tables with the complete schema
 */
export function initDatabase(): void {
	const db = getDbSync();

	const flags: MigrationFlags = {
		hasLegacyUserProviders:
			(db
				.select({ name: sql`name` })
				.from(sql`sqlite_master`)
				.where(sql`type = 'table' AND name = 'user_providers'`)
				.get() as { name: string } | undefined) != null,

		hasLegacyPasswordHashColumn:
			(db
				.select({ name: sql`name` })
				.from(sql`pragma_table_info('users')`)
				.where(sql`name = 'password_hash'`)
				.get() as { name: string } | undefined) != null,

		hasNullableSessionToken:
			(db
				.select({ notnull: sql<number>`notnull` })
				.from(sql`pragma_table_info('sessions')`)
				.where(sql`name = 'token' AND notnull = 0`)
				.get() as { notnull: number } | undefined) != null
	};

	initAuthTables(db, flags);
	initClusterTables(db);
	initRbacTables(db);
	initAuditTables(db);
	initSecurityTables(db, flags);

	logger.info('✓ Database tables initialized');
}
