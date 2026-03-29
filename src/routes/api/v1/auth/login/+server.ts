import { logger } from '$lib/server/logger.js';
import { json, error, isHttpError, isRedirect } from '@sveltejs/kit';
import { z } from '$lib/server/openapi';
import type { RequestHandler } from './$types';
import {
	authenticateUser,
	getUserByUsername,
	normalizeUsername,
	hashPassword,
	verifyPassword
} from '$lib/server/auth';
import { logLogin } from '$lib/server/audit';
import {
	createBetterAuthSessionForUser,
	revokeBetterAuthSessionByCookieValue
} from '$lib/server/auth/better-auth';

// Generate a real bcrypt hash at startup for timing-attack mitigation (avoids malformed-hash fast-path)
const DUMMY_HASH: Promise<string> = hashPassword('__dummy_password_for_timing__');
import { checkRateLimit, accountLockout } from '$lib/server/rate-limiter';

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
								role: z.string()
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
				description: 'Account is disabled',
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
	const { request, cookies, getClientAddress, setHeaders, locals } = event;

	if (!locals.cluster) {
		throw error(400, { message: 'Missing cluster context' });
	}

	try {
		const body = await request.json();
		const { username, password } = body;

		if (!username || !password) {
			throw error(400, { message: 'Username and password are required' });
		}

		// Normalize username to a canonical form (lowercase, trimmed)
		const canonicalUsername = normalizeUsername(username);

		// Validation: short-circuit if normalized username is empty
		if (!canonicalUsername) {
			throw error(401, { message: 'Invalid username or password' });
		}

		// Rate limit: 5 attempts per 1 minute per IP
		const ipAddress = getClientAddress();
		const limitKey = `login:ip:${ipAddress}`;
		checkRateLimit({ setHeaders }, limitKey, 5, 60 * 1000);

		// Check account lockout
		const lockoutStatus = accountLockout.check(canonicalUsername);
		if (lockoutStatus.locked) {
			setHeaders({
				'Retry-After': lockoutStatus.retryAfter.toString()
			});
			throw error(429, {
				message: `Account locked due to too many failed attempts. Try again in ${lockoutStatus.retryAfter} seconds.`
			});
		}

		// Check if user exists first to give better error message
		const existingUser = await getUserByUsername(canonicalUsername);
		if (!existingUser) {
			// Dummy verification to mitigate timing attacks
			await verifyPassword(password, await DUMMY_HASH);

			accountLockout.recordFailure(canonicalUsername, 5);
			await logLogin(null, false, ipAddress, 'user_not_found');
			throw error(401, { message: 'Invalid username or password' });
		}

		if (!existingUser.active) {
			// Still do dummy verification here if we want to be super careful,
			// though account being disabled is already a "user exists" indicator.
			await logLogin(existingUser, false, ipAddress, 'account_disabled');
			throw error(403, { message: 'Account is disabled. Please contact an administrator.' });
		}

		const user = await authenticateUser(canonicalUsername, password);
		if (!user) {
			accountLockout.recordFailure(canonicalUsername, 5);
			await logLogin(existingUser, false, ipAddress, 'invalid_password');
			throw error(401, { message: 'Invalid username or password' });
		}

		// Reset lockout on successful login
		accountLockout.recordSuccess(canonicalUsername);

		const existingSessionCookie = cookies.get('gyre_session');
		if (existingSessionCookie) {
			try {
				await revokeBetterAuthSessionByCookieValue(existingSessionCookie);
			} catch (err) {
				logger.warn(err, '[Auth] Failed to revoke pre-existing session during login');
			}
		}

		await createBetterAuthSessionForUser(cookies, user.id, {
			ipAddress,
			userAgent: request.headers.get('user-agent') ?? undefined
		});

		await logLogin(user, true, ipAddress);

		return json({
			success: true,
			user: {
				id: user.id,
				username: user.username,
				email: user.email,
				role: user.role
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
