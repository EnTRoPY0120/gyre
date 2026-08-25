import { logger } from '$lib/server/logger.js';
import { json, error, isHttpError, isRedirect } from '@sveltejs/kit';
import { z } from '$lib/server/openapi';
import type { RequestHandler } from './$types';
import {
	authenticateUser,
	getUserByUsername,
	hasManagedPassword,
	normalizeUsername,
	hashPassword,
	verifyPassword
} from '$lib/server/auth';
import { logLogin } from '$lib/server/audit.js';
import { getAuthSettings } from '$lib/server/settings';
import {
	createBetterAuthSessionForUser,
	getBetterAuthSessionCookieValue,
	revokeBetterAuthSessionByCookieValue
} from '$lib/server/auth/better-auth';

// Generate a real bcrypt hash at startup for timing-attack mitigation (avoids malformed-hash fast-path)
const DUMMY_HASH: Promise<string> = hashPassword('__dummy_password_for_timing__');
import { checkRateLimit, accountLockout } from '$lib/server/rate-limiter';

type LoginRequestBody = { username?: string; password?: string };

async function parseLoginCredentials(request: Request) {
	const body = (await request.json()) as LoginRequestBody;
	const { username, password } = body;

	if (!username || !password) {
		throw error(400, { message: 'Username and password are required' });
	}

	const canonicalUsername = normalizeUsername(username);
	if (!canonicalUsername) {
		throw error(401, { message: 'Invalid username or password' });
	}

	return { canonicalUsername, password };
}

function enforceLoginLimits(
	canonicalUsername: string,
	getClientAddress: () => string,
	setHeaders: (headers: Record<string, string>) => void
) {
	const ipAddress = getClientAddress();
	checkRateLimit({ setHeaders }, `login:ip:${ipAddress}`, 5, 60 * 1000);

	const lockoutStatus = accountLockout.check(canonicalUsername);
	if (lockoutStatus.locked) {
		setHeaders({ 'Retry-After': lockoutStatus.retryAfter.toString() });
		throw error(429, {
			message: `Account locked due to too many failed attempts. Try again in ${lockoutStatus.retryAfter} seconds.`
		});
	}

	return ipAddress;
}

async function authenticateKnownUser(
	canonicalUsername: string,
	password: string,
	ipAddress: string
) {
	const existingUser = await getUserByUsername(canonicalUsername);
	if (!existingUser) {
		await verifyPassword(password, await DUMMY_HASH);
		accountLockout.recordFailure(canonicalUsername, 5);
		await logLogin(null, false, ipAddress, 'user_not_found');
		throw error(401, { message: 'Invalid username or password' });
	}

	if (!existingUser.active) {
		await verifyPassword(password, await DUMMY_HASH);
		accountLockout.recordFailure(canonicalUsername, 5);
		await logLogin(existingUser, false, ipAddress, 'account_disabled');
		throw error(401, { message: 'Invalid username or password' });
	}

	const user = await authenticateUser(canonicalUsername, password);
	if (!user) {
		accountLockout.recordFailure(canonicalUsername, 5);
		await logLogin(existingUser, false, ipAddress, 'invalid_password');
		throw error(401, { message: 'Invalid username or password' });
	}

	return user;
}

async function revokeExistingSession(
	cookies: Parameters<typeof getBetterAuthSessionCookieValue>[0]
) {
	const existingSessionCookie = getBetterAuthSessionCookieValue(cookies);
	if (!existingSessionCookie) return;

	try {
		await revokeBetterAuthSessionByCookieValue(existingSessionCookie);
	} catch (err) {
		logger.warn(err, '[Auth] Failed to revoke pre-existing session during login');
	}
}

export const _metadata = {
	POST: {
		summary: 'Authenticate user and create session',
		description: 'Log in with a username and password to start a session.',
		tags: ['Auth'],
		request: {
			body: {
				content: {
					'application/json': {
						schema: z.object({
							username: z.string().min(1).openapi({ example: 'admin' }),
							password: z.string().min(1).openapi({ example: 'password123' })
						})
					}
				}
			}
		},
		responses: {
			200: {
				description: 'Successful login',
				content: {
					'application/json': {
						schema: z.object({
							success: z.boolean(),
							user: z.object({
								id: z.string(),
								username: z.string(),
								email: z.string().nullable(),
								role: z.string(),
								requiresPasswordChange: z.boolean(),
								canChangePassword: z.boolean()
							})
						})
					}
				}
			},
			400: {
				description: 'Username and password are required',
				content: {
					'application/json': {
						schema: z.object({ message: z.string() })
					}
				}
			},
			401: {
				description: 'Invalid credentials',
				content: {
					'application/json': {
						schema: z.object({ message: z.string() })
					}
				}
			},
			403: {
				description: 'Local username/password sign-in is disabled',
				content: {
					'application/json': {
						schema: z.object({ message: z.string() })
					}
				}
			},
			429: {
				description: 'Too many login attempts',
				content: {
					'application/json': {
						schema: z.object({ message: z.string() })
					}
				}
			},
			500: {
				description: 'Internal server error',
				content: {
					'application/json': {
						schema: z.object({ message: z.string() })
					}
				}
			}
		}
	}
};

/**
 * POST /api/auth/login
 * Authenticate user and create session
 */
export const POST: RequestHandler = async (event) => {
	const { request, cookies, getClientAddress, setHeaders } = event;

	try {
		const authSettings = await getAuthSettings();
		if (!authSettings.localLoginEnabled) {
			throw error(403, { message: 'Local username/password sign-in is disabled.' });
		}

		const { canonicalUsername, password } = await parseLoginCredentials(request);
		const ipAddress = enforceLoginLimits(canonicalUsername, getClientAddress, setHeaders);
		const user = await authenticateKnownUser(canonicalUsername, password, ipAddress);

		// Reset lockout on successful login
		accountLockout.recordSuccess(canonicalUsername);

		await revokeExistingSession(cookies);

		await createBetterAuthSessionForUser(cookies, user.id, {
			ipAddress,
			userAgent: request.headers.get('user-agent') ?? undefined
		});
		const canChangePassword = user.isLocal !== false && (await hasManagedPassword(user.id));

		await logLogin(user, true, ipAddress);

		return json({
			success: true,
			user: {
				id: user.id,
				username: user.username,
				email: user.email,
				role: user.role,
				requiresPasswordChange: user.requiresPasswordChange,
				canChangePassword
			}
		});
	} catch (err) {
		if (isHttpError(err) || isRedirect(err)) {
			throw err;
		}
		logger.error(err, 'Login error:');
		throw error(500, { message: 'Internal server error' });
	}
};
