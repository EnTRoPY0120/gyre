const _maxSessionsEnv = parseInt(process.env.MAX_SESSIONS_PER_USER ?? '', 10);

export const SESSION_DURATION_DAYS = 2;
export const ADMIN_SECRET_NAME =
	process.env.GYRE_ADMIN_SECRET_NAME?.trim() || 'gyre-initial-admin-secret';
export const MAX_SESSIONS_PER_USER =
	Number.isFinite(_maxSessionsEnv) && _maxSessionsEnv > 0 ? _maxSessionsEnv : 10;
export const PASSWORD_HISTORY_LIMIT = 5;
export const SALT_ROUNDS = 12;
