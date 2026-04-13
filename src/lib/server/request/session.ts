import {
	BETTER_AUTH_SESSION_COOKIE_NAME,
	getBetterAuthSession
} from '$lib/server/auth/better-auth.js';
import { CSRF_COOKIE_OPTIONS } from '$lib/server/config.js';
import { generateCsrfToken } from '$lib/server/csrf.js';
import type { RequestEvent } from '@sveltejs/kit';

export async function hydrateSessionLocals(
	event: Pick<RequestEvent, 'cookies' | 'locals' | 'request'>
): Promise<void> {
	event.locals.user = null;
	event.locals.session = null;
	event.locals.cluster = undefined;

	if (!event.cookies.get(BETTER_AUTH_SESSION_COOKIE_NAME)) {
		return;
	}

	const sessionData = await getBetterAuthSession(event.request, event.cookies);
	if (!sessionData) {
		event.cookies.delete(BETTER_AUTH_SESSION_COOKIE_NAME, { path: '/' });
		return;
	}

	event.locals.user = sessionData.user;
	event.locals.session = sessionData.session;

	const csrfToken = generateCsrfToken(sessionData.session.id);
	if (event.cookies.get('gyre_csrf') !== csrfToken) {
		event.cookies.set('gyre_csrf', csrfToken, CSRF_COOKIE_OPTIONS);
	}
}
