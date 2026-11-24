import Database from 'better-sqlite3';
import { createLocalAccountIssuer, createOAuthAccountIssuer } from './auth/account-issuer.js';
import { migrateDatabase } from './db/migrate.js';
import { BackupError } from './backup-errors.js';

interface Column {
	name: string;
	type: string;
	notnull: number;
	pk: number;
}
interface TableContract {
	columns: Column[];
	uniqueKeys: UniqueKey[];
	foreignKeys: string[];
}
interface UniqueKey {
	signature: string;
	partial: boolean;
}

function inspectTable(db: Database.Database, table: string): TableContract {
	const columns = db
		.prepare('SELECT name, type, "notnull", pk FROM pragma_table_info(?)')
		.all(table) as Column[];
	const indexes = db
		.prepare('SELECT name, partial FROM pragma_index_list(?) WHERE "unique" = 1')
		.all(table) as { name: string; partial: number }[];
	const uniqueKeys = indexes.map(({ name, partial }) => {
		const columns = db
			.prepare('SELECT name, cid, coll FROM pragma_index_xinfo(?) WHERE key = 1')
			.all(name) as { name: string | null; cid: number; coll: string | null }[];
		let signature: string;
		if (columns.some(({ name }) => name === null)) {
			signature = JSON.stringify(columns);
		} else {
			const normalized = [
				...new Map(
					columns.map(({ name, coll }) => [
						`${name}:${coll?.toLowerCase() ?? ''}`,
						{ name, coll: coll?.toLowerCase() ?? null }
					])
				).values()
			].sort(
				(left, right) =>
					(left.name ?? '').localeCompare(right.name ?? '') ||
					(left.coll ?? '').localeCompare(right.coll ?? '')
			);
			signature = JSON.stringify(normalized);
		}
		return { signature, partial: partial === 1 };
	});
	const foreignKeys = db
		.prepare(
			'SELECT "table", "from", "to", on_update, on_delete, match FROM pragma_foreign_key_list(?) ORDER BY "from"'
		)
		.all(table)
		.map((key) => JSON.stringify(key));
	return { columns, uniqueKeys, foreignKeys };
}

let currentContract: Map<string, TableContract> | undefined;

/** Derive the complete contract from the same migrations startup uses, once per process. */
function getCurrentContract(): Map<string, TableContract> {
	if (currentContract) return currentContract;
	const reference = new Database(':memory:');
	try {
		migrateDatabase(reference);
		const tables = reference
			.prepare("SELECT name FROM sqlite_master WHERE type = 'table'")
			.all() as { name: string }[];
		currentContract = new Map(tables.map(({ name }) => [name, inspectTable(reference, name)]));
		return currentContract;
	} finally {
		reference.close();
	}
}

// These are the only source-schema differences the existing migration sequence can upgrade.
// Current, pre-issuer and legacy password/SSO fixtures exercise this contract in restore tests.
const LEGACY_ADDED_COLUMNS: Record<string, string[]> = {
	users: ['preferences', 'name', 'email_verified', 'image', 'requires_password_change'],
	sessions: ['token', 'updated_at'],
	accounts: [
		'issuer',
		'last_login_at',
		'access_token_encrypted',
		'refresh_token_encrypted',
		'id_token_encrypted'
	],
	rate_limits: ['expire_at']
};
const LEGACY_ADDED_TABLES = new Set([
	'accounts',
	'verifications',
	'reconciliation_history',
	'login_lockouts',
	'rate_limits',
	'password_history'
]);

function invalid(message: string): never {
	throw new BackupError(`Invalid backup: ${message}`, 400);
}

/** Recognize supported sources before migrations can create missing schema around unrelated data. */
export function validateSourceSchema(db: Database.Database): void {
	const users = inspectTable(db, 'users');
	const legacy = users.columns.some(({ name }) => name === 'password_hash');
	const tables = new Set(
		(
			db.prepare("SELECT name FROM sqlite_master WHERE type = 'table'").all() as { name: string }[]
		).map(({ name }) => name)
	);
	if (db.prepare("SELECT 1 FROM sqlite_master WHERE type IN ('trigger', 'view') LIMIT 1").get())
		invalid('unsupported triggers or views');
	for (const [name, expected] of getCurrentContract()) {
		if (!tables.has(name)) {
			if (legacy && LEGACY_ADDED_TABLES.has(name)) continue;
			invalid(`missing required table: ${name}`);
		}
		const actual = inspectTable(db, name);
		for (const column of expected.columns) {
			const found = actual.columns.find(({ name }) => name === column.name);
			const canAdd = LEGACY_ADDED_COLUMNS[name]?.includes(column.name);
			if (!found && canAdd) continue;
			if (
				!found ||
				found.type.toUpperCase() !== column.type.toUpperCase() ||
				found.pk !== column.pk
			)
				invalid(`${name} has missing or unsupported column: ${column.name}`);
		}
	}
	if (tables.has('user_providers')) {
		const columns = inspectTable(db, 'user_providers').columns;
		for (const name of [
			'provider_id',
			'provider_user_id',
			'user_id',
			'last_login_at',
			'created_at'
		]) {
			if (!columns.some((column) => column.name === name))
				invalid(`user_providers missing column: ${name}`);
		}
	}
}

/** Require all application columns, nullability, primary/unique keys and foreign-key declarations. */
export function validateBackupSchema(db: Database.Database): void {
	for (const [name, expected] of getCurrentContract()) {
		const actual = inspectTable(db, name);
		for (const column of expected.columns) {
			const found = actual.columns.find(({ name }) => name === column.name);
			if (
				!found ||
				found.type.toUpperCase() !== column.type.toUpperCase() ||
				found.pk !== column.pk ||
				found.notnull < column.notnull
			)
				invalid(`${name} has missing or unsupported column: ${column.name}`);
		}
		const unsupportedRequiredColumn = actual.columns.find(
			(column) =>
				!expected.columns.some((expectedColumn) => expectedColumn.name === column.name) &&
				column.notnull > 0 &&
				column.pk === 0
		);
		if (unsupportedRequiredColumn)
			invalid(
				`${name} has an unsupported additional required column: ${unsupportedRequiredColumn.name}`
			);
		if (
			actual.columns.filter(({ pk }) => pk).length !==
			expected.columns.filter(({ pk }) => pk).length
		)
			invalid(`${name} has an unsupported primary key`);
		if (
			expected.uniqueKeys.some(
				(key) =>
					!actual.uniqueKeys.some(
						(actualKey) =>
							actualKey.signature === key.signature && actualKey.partial === key.partial
					)
			)
		)
			invalid(`${name} is missing a required unique key`);
		const expectedFullUniqueKeys = new Set(
			expected.uniqueKeys.filter((key) => !key.partial).map(({ signature }) => signature)
		);
		if (
			actual.uniqueKeys.some(
				(key) =>
					!expected.uniqueKeys.some(
						(expectedKey) =>
							expectedKey.signature === key.signature && expectedKey.partial === key.partial
					) && !(key.partial && expectedFullUniqueKeys.has(key.signature))
			)
		)
			invalid(`${name} has an unsupported additional unique key`);
		if (expected.foreignKeys.some((key) => !actual.foreignKeys.includes(key)))
			invalid(`${name} is missing a required foreign key`);
	}
	const accounts = db.prepare('SELECT provider_id, issuer FROM accounts').all() as {
		provider_id: string;
		issuer: string;
	}[];
	for (const account of accounts) {
		const issuer =
			account.provider_id === 'credential'
				? createLocalAccountIssuer(account.provider_id)
				: createOAuthAccountIssuer(account.provider_id);
		if (account.issuer !== issuer) invalid('accounts contain unsupported issuers');
	}
}

export function validateDatabaseIntegrity(db: Database.Database): void {
	const checks = db.pragma('integrity_check') as { integrity_check: string }[];
	if (checks.length !== 1 || checks[0].integrity_check !== 'ok')
		invalid('SQLite integrity check failed');
	if ((db.pragma('foreign_key_check') as unknown[]).length) invalid('foreign key check failed');
}
