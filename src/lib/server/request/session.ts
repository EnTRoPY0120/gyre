import {
	getBetterAuthSessionCookieValue,
	clearBetterAuthSessionCookie,
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

	if (!getBetterAuthSessionCookieValue(event.cookies)) {
		return;
	}

	const sessionData = await getBetterAuthSession(event.request, event.cookies);
	if (!sessionData) {
		clearBetterAuthSessionCookie(event.cookies);
		return;
	}

	event.locals.user = sessionData.user;
	event.locals.session = sessionData.session;

	const csrfToken = generateCsrfToken(sessionData.session.id);
	if (event.cookies.get('gyre_csrf') !== csrfToken) {
		event.cookies.set('gyre_csrf', csrfToken, CSRF_COOKIE_OPTIONS);
	}
}
