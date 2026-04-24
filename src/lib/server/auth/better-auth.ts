import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { parseSetCookieHeader } from 'better-auth/cookies';
import { makeSignature } from 'better-auth/crypto';
import { username } from 'better-auth/plugins/username';
import type { Cookies } from '@sveltejs/kit';
import { randomBytes } from 'node:crypto';
import { logger } from '$lib/server/logger.js';
import { getDb, getDbSync, schema } from '$lib/server/db';
import { DEFAULT_COOKIE_OPTIONS, IS_PROD } from '$lib/server/config';
import { encryptSecret } from '$lib/server/auth/crypto';
import { accounts, users, type Session, type User } from '$lib/server/db/schema';
import {
	MAX_SESSIONS_PER_USER,
	SESSION_DURATION_DAYS,
	hashPassword,
	normalizeUsername,
	verifyPassword
} from '$lib/server/auth';
import type { OAuthTokens } from '$lib/server/auth/oauth';
import { and, eq } from 'drizzle-orm';

export const BETTER_AUTH_BASE_PATH = '/api/v1/auth';
export const BETTER_AUTH_SESSION_COOKIE_NAME = 'gyre_session';
export const BETTER_AUTH_SESSION_COOKIE_NAMES = [
	BETTER_AUTH_SESSION_COOKIE_NAME,
	`__Secure-${BETTER_AUTH_SESSION_COOKIE_NAME}`
] as const;

function createBetterAuth() {
	return betterAuth({
		appName: 'Gyre',
		basePath: BETTER_AUTH_BASE_PATH,
		secret: getBetterAuthSecret(),
		database: drizzleAdapter(getDbSync(), {
			provider: 'sqlite',
			schema,
			usePlural: false,
			camelCase: false,
			transaction: true
		}),
		emailAndPassword: {
			enabled: true,
			minPasswordLength: 8,
			maxPasswordLength: 128,
			disableSignUp: true,
			autoSignIn: false,
			password: {
				hash: hashPassword,
				verify: async ({ hash, password }) => verifyPassword(password, hash)
			}
		},
		plugins: [
			username({
				minUsernameLength: 3,
				maxUsernameLength: 64,
				usernameNormalization: normalizeUsername
			})
		],
		session: {
			expiresIn: SESSION_DURATION_DAYS * 24 * 60 * 60,
			updateAge: (SESSION_DURATION_DAYS * 24 * 60 * 60) / 2,
			modelName: 'sessions',
			additionalFields: {}
		},
		user: {
			modelName: 'users',
			additionalFields: {
				role: {
					type: 'string',
					required: false,
					defaultValue: 'viewer'
				},
				active: {
					type: 'boolean',
					required: false,
					defaultValue: true
				},
				isLocal: {
					type: 'boolean',
					required: false,
					fieldName: 'is_local',
					defaultValue: true
				},
				preferences: {
					type: 'string',
					required: false,
					returned: false
				}
			}
		},
		account: {
			modelName: 'accounts',
			additionalFields: {
				lastLoginAt: {
					type: 'date',
					required: false,
					fieldName: 'last_login_at'
				},
				accessTokenEncrypted: {
					type: 'string',
					required: false,
					fieldName: 'access_token_encrypted',
					returned: false
				},
				refreshTokenEncrypted: {
					type: 'string',
					required: false,
					fieldName: 'refresh_token_encrypted',
					returned: false
				},
				idTokenEncrypted: {
					type: 'string',
					required: false,
					fieldName: 'id_token_encrypted',
					returned: false
				}
			}
		},
		verification: {
			modelName: 'verifications'
		},
		advanced: {
			useSecureCookies: IS_PROD,
			defaultCookieAttributes: DEFAULT_COOKIE_OPTIONS,
			cookies: {
				session_token: {
					name: BETTER_AUTH_SESSION_COOKIE_NAME,
					attributes: DEFAULT_COOKIE_OPTIONS
				}
			}
		}
	});
}

let authInstance: ReturnType<typeof createBetterAuth> | null = null;

let _ephemeralSecret: string | null = null;
function getEphemeralSecret(): string {
	if (!_ephemeralSecret) {
		_ephemeralSecret = randomBytes(32).toString('hex');
		logger.warn(
			'[Auth] No BETTER_AUTH_SECRET or AUTH_ENCRYPTION_KEY configured — using an ephemeral random secret. All sessions will be invalidated on restart. Set BETTER_AUTH_SECRET to persist sessions.'
		);
	}
	return _ephemeralSecret;
}

function getBetterAuthSecret(): string {
	const configuredSecret = process.env.BETTER_AUTH_SECRET ?? process.env.AUTH_ENCRYPTION_KEY;

	if (configuredSecret) {
		return configuredSecret;
	}

	if (process.env.NODE_ENV === 'production') {
		throw new Error('Better Auth requires BETTER_AUTH_SECRET or AUTH_ENCRYPTION_KEY in production');
	}

	return getEphemeralSecret();
}

export function getBetterAuth() {
	if (authInstance) {
		return authInstance;
	}

	authInstance = createBetterAuth();

	return authInstance;
}

export type BetterAuthInstance = ReturnType<typeof getBetterAuth>;

function toSvelteCookieOptions(attributes: {
	path?: string;
	domain?: string;
	expires?: Date;
	httpOnly?: boolean;
	maxAge?: number;
	sameSite?: string;
	secure?: boolean;
}) {
	return {
		path: attributes.path || '/',
		domain: attributes.domain,
		expires: attributes.expires,
		httpOnly: attributes.httpOnly,
		maxAge: attributes.maxAge,
		sameSite: (attributes.sameSite || DEFAULT_COOKIE_OPTIONS.sameSite) as 'lax' | 'strict' | 'none',
		secure: attributes.secure
	};
}

export function applyBetterAuthCookies(cookies: Cookies, headers: Headers): void {
	const setCookieHeader = headers.get('set-cookie');
	if (!setCookieHeader) {
		return;
	}

	const parsedCookies = parseSetCookieHeader(setCookieHeader);
	for (const [name, { value, ...options }] of parsedCookies) {
		cookies.set(
			name,
			value,
			toSvelteCookieOptions({
				path: options.path,
				domain: options.domain,
				expires: options.expires,
				httpOnly: options.httponly,
				maxAge: options['max-age'],
				sameSite: options.samesite,
				secure: options.secure
			})
		);
	}
}

export function getBetterAuthSessionCookieValue(cookies: Pick<Cookies, 'get'>): string | undefined {
	for (const cookieName of BETTER_AUTH_SESSION_COOKIE_NAMES) {
		const cookieValue = cookies.get(cookieName);
		if (cookieValue) {
			return cookieValue;
		}
	}

	return undefined;
}

export function clearBetterAuthSessionCookie(cookies: Cookies): void {
	for (const cookieName of BETTER_AUTH_SESSION_COOKIE_NAMES) {
		cookies.delete(cookieName, {
			path: DEFAULT_COOKIE_OPTIONS.path
		});
	}
}

async function deleteBetterAuthSessionRow(sessionLike: Record<string, unknown>): Promise<void> {
	const db = await getDb();
	const sessionId = typeof sessionLike.id === 'string' ? sessionLike.id : null;
	const sessionToken = typeof sessionLike.token === 'string' ? sessionLike.token : null;

	if (sessionId) {
		await db.delete(schema.sessions).where(eq(schema.sessions.id, sessionId));
		return;
	}

	if (sessionToken) {
		await db.delete(schema.sessions).where(eq(schema.sessions.token, sessionToken));
	}
}

export async function getBetterAuthSession(
	request: Request,
	cookies: Cookies
): Promise<{
	session: Session;
	user: User;
} | null> {
	const auth = getBetterAuth();
	const result = await auth.api.getSession({
		headers: request.headers,
		returnHeaders: true
	});

	applyBetterAuthCookies(cookies, result.headers);

	if (!result.response) {
		logger.warn('[Auth] getBetterAuthSession: getSession returned null (no valid session found)');
		return null;
	}

	logger.debug(
		{ userId: result.response.user.id },
		'[Auth] getBetterAuthSession: session found, loading full user'
	);

	const db = await getDb();
	const fullUser = await db.query.users.findFirst({
		where: eq(users.id, result.response.user.id)
	});

	if (!fullUser || !fullUser.active) {
		logger.warn(
			{ userId: result.response.user.id, userFound: !!fullUser, active: fullUser?.active },
			'[Auth] getBetterAuthSession: user not found or inactive, revoking session'
		);
		try {
			await deleteBetterAuthSessionRow(result.response.session as Record<string, unknown>);
		} catch (err) {
			logger.warn(err, '[Auth] Failed to delete stale Better Auth session row');
		}
		clearBetterAuthSessionCookie(cookies);
		return null;
	}

	return {
		session: result.response.session as Session,
		user: fullUser
	};
}

export async function ensureBetterAuthOAuthAccount(
	userId: string,
	providerId: string,
	providerUserId: string,
	tokens?: OAuthTokens
): Promise<void> {
	const ctx = await getBetterAuth().$context;
	const db = await getDb();
	const existingAccount = await db.query.accounts.findFirst({
		where: and(eq(accounts.providerId, providerId), eq(accounts.accountId, providerUserId))
	});

	const accountData = {
		userId,
		providerId,
		accountId: providerUserId,
		accessToken: null,
		refreshToken: null,
		idToken: null,
		accessTokenExpiresAt:
			tokens?.expiresIn != null
				? new Date(Date.now() + tokens.expiresIn * 1000)
				: (existingAccount?.accessTokenExpiresAt ?? null),
		scope: tokens?.scope ?? existingAccount?.scope ?? null,
		lastLoginAt: new Date(),
		accessTokenEncrypted: tokens?.accessToken
			? encryptSecret(tokens.accessToken)
			: (((existingAccount as Record<string, unknown> | undefined)?.accessTokenEncrypted as
					| string
					| null
					| undefined) ?? null),
		refreshTokenEncrypted: tokens?.refreshToken
			? encryptSecret(tokens.refreshToken)
			: (((existingAccount as Record<string, unknown> | undefined)?.refreshTokenEncrypted as
					| string
					| null
					| undefined) ?? null),
		idTokenEncrypted: tokens?.idToken
			? encryptSecret(tokens.idToken)
			: (((existingAccount as Record<string, unknown> | undefined)?.idTokenEncrypted as
					| string
					| null
					| undefined) ?? null)
	};

	if (existingAccount) {
		await ctx.internalAdapter.updateAccount(existingAccount.id, accountData);
		return;
	}

	await ctx.internalAdapter.linkAccount(accountData);
}

export async function createBetterAuthSessionForUser(
	cookies: Cookies,
	userId: string,
	sessionDetails?: {
		ipAddress?: string;
		userAgent?: string;
	}
): Promise<Session> {
	const ctx = await getBetterAuth().$context;
	// Create the session first so the user always gets a session, then evict
	// any sessions that exceed the per-user limit. This avoids a TOCTOU race
	// where two concurrent logins both read N-1 sessions and skip eviction,
	// ending up with N+1. With create-then-evict both concurrent creates will
	// prune the same excess tokens and converge to MAX_SESSIONS_PER_USER.
	const session = await ctx.internalAdapter.createSession(userId, false, {
		ipAddress: sessionDetails?.ipAddress ?? null,
		userAgent: sessionDetails?.userAgent ?? null
	});
	const allSessions = await ctx.internalAdapter.listSessions(userId, {
		onlyActiveSessions: true
	});
	if (allSessions.length > MAX_SESSIONS_PER_USER) {
		const tokensToEvict = allSessions
			.filter((s) => s.token !== session.token)
			.sort(
				(left, right) => new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime()
			)
			.slice(0, allSessions.length - MAX_SESSIONS_PER_USER)
			.map((s) => s.token);
		if (tokensToEvict.length > 0) {
			await ctx.internalAdapter.deleteSessions(tokensToEvict);
			logger.info(
				{ userId, evictCount: tokensToEvict.length },
				`[Auth] Evicted ${tokensToEvict.length} oldest session(s) to enforce MAX_SESSIONS_PER_USER=${MAX_SESSIONS_PER_USER}`
			);
		}
	}
	const signedToken = `${session.token}.${await makeSignature(session.token, ctx.secret)}`;

	cookies.set(
		ctx.authCookies.sessionToken.name,
		signedToken,
		toSvelteCookieOptions({
			...ctx.authCookies.sessionToken.attributes,
			maxAge: ctx.sessionConfig.expiresIn
		})
	);

	return session as Session;
}

export async function revokeBetterAuthSessionByCookieValue(
	signedSessionCookie: string
): Promise<void> {
	const tokenSeparatorIndex = signedSessionCookie.lastIndexOf('.');
	if (tokenSeparatorIndex <= 0) {
		return;
	}

	const rawToken = signedSessionCookie.slice(0, tokenSeparatorIndex);
	const providedSignature = signedSessionCookie.slice(tokenSeparatorIndex + 1);

	if (!rawToken || !providedSignature) {
		return;
	}

	const ctx = await getBetterAuth().$context;
	const expectedSignature = await makeSignature(rawToken, ctx.secret);
	if (providedSignature !== expectedSignature) {
		return;
	}

	await ctx.internalAdapter.deleteSessions([rawToken]);
}
