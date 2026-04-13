import { validateCsrfToken } from '$lib/server/csrf.js';
import { logger } from '$lib/server/logger.js';
import { isPublicRoute } from '$lib/isPublicRoute.js';
import { STATE_CHANGING_METHODS, isPayloadTooLargeError } from './request-size.js';
import type { RequestEvent } from '@sveltejs/kit';

export async function enforceCsrfProtection(
	event: Pick<RequestEvent, 'locals' | 'request' | 'url'>
): Promise<Response | null> {
	const path = event.url.pathname;
	if (
		!event.locals.session ||
		!STATE_CHANGING_METHODS.includes(event.request.method) ||
		isPublicRoute(path)
	) {
		return null;
	}

	// Header first; fall back to form body for use:enhance forms that still
	// submit _csrf as a hidden field until they are migrated to the header.
	// Only call formData() when the header is absent and the content-type is
	// form-compatible to avoid parsing non-form bodies or masking size errors.
	// Clone event.request (not the original request whose body is already
	// piped into the size-guard transform).
	const headerToken = event.request.headers.get('x-csrf-token');
	let csrfToken: string;

	if (headerToken !== null) {
		csrfToken = headerToken;
	} else {
		const contentType = event.request.headers.get('content-type') ?? '';
		const isFormCompatible =
			contentType.startsWith('multipart/form-data') ||
			contentType.startsWith('application/x-www-form-urlencoded');

		if (isFormCompatible) {
			try {
				const formData = await event.request.clone().formData();
				const rawToken = formData.get('_csrf');
				csrfToken = typeof rawToken === 'string' ? rawToken : '';
			} catch (err) {
				if (isPayloadTooLargeError(err)) {
					throw err;
				}
				csrfToken = '';
			}
		} else {
			csrfToken = '';
		}
	}

	if (validateCsrfToken(event.locals.session.id, csrfToken)) {
		return null;
	}

	logger.warn('CSRF token validation failed', {
		userId: event.locals.user?.id,
		method: event.request.method,
		path
	});

	return new Response(
		JSON.stringify({ error: 'Forbidden', message: 'Invalid or missing CSRF token' }),
		{
			status: 403,
			headers: { 'Content-Type': 'application/json' }
		}
	);
}
