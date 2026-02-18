import { json, error, isHttpError, isRedirect } from '@sveltejs/kit';
import { z } from 'zod';
import type { RequestHandler } from './$types';
import { authenticateUser, createSession, getUserByUsername } from '$lib/server/auth';
import { checkRateLimit } from '$lib/server/rate-limiter';

export const metadata = {
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
	const { request, cookies, getClientAddress, setHeaders } = event;
	try {
		const body = await request.json();
		const { username, password } = body;

		if (!username || !password) {
			throw error(400, { message: 'Username and password are required' });
		}

		// Rate limit: 5 attempts per 5 minutes per IP + Username
		const ipAddress = getClientAddress();
		const limitKey = `login:${ipAddress}:${username}`;
		checkRateLimit({ request, setHeaders }, limitKey, 5, 5 * 60 * 1000);

		// Check if user exists first to give better error message
		const existingUser = await getUserByUsername(username);
		if (!existingUser) {
			throw error(401, { message: 'Invalid username or password' });
		}

		if (!existingUser.active) {
			throw error(403, { message: 'Account is disabled. Please contact an administrator.' });
		}

		// Authenticate user
		const user = await authenticateUser(username, password);

		if (!user) {
			throw error(401, { message: 'Invalid username or password' });
		}

		// Create session
		const userAgent = request.headers.get('user-agent') || undefined;
		const sessionId = await createSession(user.id, ipAddress, userAgent);

		// Set session cookie
		cookies.set('gyre_session', sessionId, {
			path: '/',
			httpOnly: true,
			secure: true,
			sameSite: 'lax',
			maxAge: 60 * 60 * 24 * 7 // 7 days
		});

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
		console.error('Login error:', err);
		throw error(500, { message: 'Internal server error' });
	}
};
