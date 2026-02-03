import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { authenticateUser, createSession } from '$lib/server/auth';
import { isInClusterMode } from '$lib/server/mode';

/**
 * POST /api/auth/login
 * Authenticate user and create session
 */
export const POST: RequestHandler = async ({ request, cookies, getClientAddress }) => {
	try {
		const body = await request.json();
		const { username, password } = body;

		if (!username || !password) {
			return error(400, { message: 'Username and password are required' });
		}

		// Authenticate user
		const user = await authenticateUser(username, password);

		if (!user) {
			return error(401, { message: 'Invalid username or password' });
		}

		if (!user.active) {
			return error(403, { message: 'Account is disabled' });
		}

		// Create session
		const userAgent = request.headers.get('user-agent') || undefined;
		const ipAddress = getClientAddress();
		const sessionId = await createSession(user.id, ipAddress, userAgent);

		// Set session cookie
		cookies.set('gyre_session', sessionId, {
			path: '/',
			httpOnly: true,
			secure: !isInClusterMode(), // Secure in production, non-secure in local dev
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
		console.error('Login error:', err);
		if (err instanceof Error && 'status' in err && typeof err.status === 'number') {
			throw err;
		}
		return error(500, { message: 'Internal server error' });
	}
};
