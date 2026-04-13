import { IS_PROD } from '$lib/server/config.js';
import { httpRequestDurationMicroseconds } from '$lib/server/metrics.js';
import type { RequestEvent } from '@sveltejs/kit';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface RequestContextState {
	path: string;
	requestId: string;
	startTimeMs: number;
}

function setSecurityHeaders(response: Response): void {
	response.headers.set('X-Content-Type-Options', 'nosniff');
	response.headers.set('X-Frame-Options', 'DENY');
	response.headers.set('X-Permitted-Cross-Domain-Policies', 'none');
	response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
	// Content-Security-Policy is managed by SvelteKit via kit.csp in svelte.config.js,
	// which injects per-request nonces into inline hydration scripts. Setting it here
	// would overwrite those nonces and break page hydration.
	if (IS_PROD) {
		response.headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
	}
}

export function assignRequestContext(event: RequestEvent): RequestContextState {
	const requestIdRaw = event.request.headers.get('x-request-id');
	const requestId =
		requestIdRaw && UUID_REGEX.test(requestIdRaw) ? requestIdRaw : crypto.randomUUID();

	event.locals.requestId = requestId;

	return {
		path: event.url.pathname,
		requestId,
		startTimeMs: Date.now()
	};
}

export function finalizeResponse(
	event: RequestEvent,
	response: Response,
	context: RequestContextState
): Response {
	if (!context.path.startsWith('/metrics')) {
		const duration = (Date.now() - context.startTimeMs) / 1000;
		const routeTemplate = event.route?.id || context.path;
		httpRequestDurationMicroseconds
			.labels(event.request.method, routeTemplate, response.status.toString())
			.observe(duration);
	}

	response.headers.set('x-request-id', context.requestId);
	setSecurityHeaders(response);
	return response;
}
