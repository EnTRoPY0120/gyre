import { json, error, isHttpError, isRedirect } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { authenticateUser, createSession, getUserByUsername } from '$lib/server/auth';
import { checkRateLimit } from '$lib/server/rate-limiter';

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
