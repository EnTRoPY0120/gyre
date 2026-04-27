import { INVALID_SPAN_CONTEXT, trace } from '@opentelemetry/api';
import type { Cookies } from '@sveltejs/kit';

type LoginRouteModule = typeof import('../../routes/api/v1/auth/login/+server.js');
export type LoginEvent = Parameters<LoginRouteModule['POST']>[0];

function createCookies(): Cookies {
	return {
		get: () => undefined,
		getAll: () => [],
		set: () => {},
		delete: () => {},
		serialize: () => ''
	};
}

export function buildLoginEvent({
	body = {
		username: 'admin',
		password: 'Password123!'
	},
	cookies = createCookies(),
	getClientAddress = () => '127.0.0.1',
	setHeaders = () => {}
}: {
	body?: unknown;
	cookies?: Cookies;
	getClientAddress?: LoginEvent['getClientAddress'];
	setHeaders?: LoginEvent['setHeaders'];
} = {}): LoginEvent {
	const request = new Request('http://localhost/api/v1/auth/login', {
		method: 'POST',
		headers: { 'content-type': 'application/json' },
		body: JSON.stringify(body)
	});

	return {
		request,
		cookies,
		fetch,
		getClientAddress,
		locals: {
			requestId: 'req-1',
			cluster: undefined,
			user: null,
			session: null
		},
		params: {},
		platform: undefined,
		route: {
			id: '/api/v1/auth/login'
		},
		setHeaders,
		url: new URL(request.url),
		isDataRequest: false,
		isSubRequest: false,
		tracing: {
			enabled: false,
			root: trace.wrapSpanContext(INVALID_SPAN_CONTEXT),
			current: trace.wrapSpanContext(INVALID_SPAN_CONTEXT)
		},
		isRemoteRequest: false
	} satisfies LoginEvent;
}
