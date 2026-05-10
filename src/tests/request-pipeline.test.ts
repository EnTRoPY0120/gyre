import { afterEach, beforeEach, describe, expect, mock, test } from 'bun:test';
import { IN_CLUSTER_ID } from '../lib/clusters/identity.js';
import type { User } from '../lib/server/db/schema.js';
import { importFresh } from './helpers/import-fresh';
import {
	createKubernetesErrorsModuleStub,
	createLoggerModuleStub,
	createRateLimiterModuleStub
} from './helpers/module-stubs';

let sessionData: {
	session: { id: string };
	user: User;
} | null = null;
let csrfValid = true;
let clusterRecord: { id: string; isActive: boolean } | null = { id: 'cluster-a', isActive: true };
const getClusterByIdCalls: string[] = [];
let errorResponse = {
	status: 500,
	body: { error: 'An unexpected error occurred', code: 'InternalServerError' }
};

const observeCalls: Array<{ labels: string[]; value: number }> = [];

function createUser(role: User['role'] = 'admin'): User {
	const now = new Date();
	return {
		id: 'user-1',
		username: role,
		email: null,
		name: role,
		emailVerified: false,
		image: null,
		role,
		active: true,
		isLocal: true,
		requiresPasswordChange: false,
		createdAt: now,
		updatedAt: now,
		preferences: null
	};
}

function createCookies(initial: Record<string, string> = {}) {
	const values = new Map(Object.entries(initial));
	const deleted: Array<{ name: string; options: Record<string, unknown> }> = [];
	const setCalls: Array<{
		name: string;
		options: Record<string, unknown>;
		value: string;
	}> = [];

	return {
		delete(name: string, options: Record<string, unknown>) {
			values.delete(name);
			deleted.push({ name, options });
		},
		deleted,
		get(name: string) {
			return values.get(name);
		},
		set(name: string, value: string, options: Record<string, unknown>) {
			values.set(name, value);
			setCalls.push({ name, options, value });
		},
		setCalls,
		values
	};
}

async function importHooks() {
	return importFresh<typeof import('../hooks.server.js')>('../hooks.server.js');
}

beforeEach(() => {
	sessionData = null;
	csrfValid = true;
	clusterRecord = { id: 'cluster-a', isActive: true };
	getClusterByIdCalls.length = 0;
	errorResponse = {
		status: 500,
		body: { error: 'An unexpected error occurred', code: 'InternalServerError' }
	};
	observeCalls.length = 0;

	mock.module('$lib/server/logger.js', () => createLoggerModuleStub());

	mock.module('$lib/server/metrics.js', () => ({
		httpRequestDurationMicroseconds: {
			labels: (...labels: string[]) => ({
				observe: (value: number) => observeCalls.push({ labels, value })
			})
		},
		loginAttemptsTotal: { labels: () => ({ inc: () => {} }) },
		sessionsCleanedUpTotal: { inc: () => {} }
	}));

	mock.module('$lib/server/initialize.js', () => ({
		initializeGyre: async () => {}
	}));

	const rateLimiterModuleStub = createRateLimiterModuleStub();
	mock.module('$lib/server/rate-limiter.js', () => rateLimiterModuleStub);
	mock.module('$lib/server/rate-limiter', () => rateLimiterModuleStub);

	const betterAuthModuleStub = {
		BETTER_AUTH_SESSION_COOKIE_NAME: 'gyre_session',
		clearBetterAuthSessionCookie: (cookies: {
			delete: (name: string, options: { path: string }) => void;
		}) => cookies.delete('gyre_session', { path: '/' }),
		getBetterAuthSessionCookieValue: (cookies: { get: (name: string) => string | undefined }) =>
			cookies.get('gyre_session'),
		getBetterAuthSession: async () => sessionData,
		createBetterAuthSessionForUser: async () => {},
		revokeBetterAuthSessionByCookieValue: async () => {},
		ensureBetterAuthOAuthAccount: async () => {},
		applyBetterAuthCookies: () => {},
		getBetterAuth: () => ({
			api: {
				changePassword: async () => ({
					headers: new Headers()
				})
			}
		})
	};

	mock.module('$lib/server/auth/better-auth.js', () => betterAuthModuleStub);
	mock.module('$lib/server/auth/better-auth', () => betterAuthModuleStub);

	mock.module('$lib/server/csrf.js', () => ({
		generateCsrfToken: (sessionId: string) => `csrf:${sessionId}`,
		validateCsrfToken: () => csrfValid
	}));

	mock.module('$lib/server/clusters/repository.js', () => ({
		getClusterById: async (id: string) => {
			getClusterByIdCalls.push(id);
			return clusterRecord;
		},
		getSelectableClusters: async () => []
	}));
	mock.module('$lib/server/clusters/local-kubeconfig.js', () => ({
		getDefaultLocalKubeconfigContext: () => null,
		hasLocalKubeconfigContext: () => false,
		shouldUseLocalKubeconfigContexts: () => false
	}));

	mock.module('$lib/server/kubernetes/errors.js', () =>
		createKubernetesErrorsModuleStub({
			errorToHttpResponse: () => errorResponse
		})
	);
});

afterEach(async () => {
	const { _resetGyreInitializationForTests } =
		await import('../lib/server/request/initialization.js');
	_resetGyreInitializationForTests();
	mock.restore();
});

describe('request pipeline', () => {
	test('propagates request ids and applies security headers', async () => {
		sessionData = {
			session: { id: 'session-1' },
			user: createUser()
		};
		const cookies = createCookies({ gyre_session: 'session-cookie' });
		const { handle } = await importHooks();

		const response = await handle({
			event: {
				cookies,
				getClientAddress: () => '127.0.0.1',
				locals: {} as App.Locals,
				request: new Request('http://localhost/dashboard', {
					headers: {
						'x-request-id': '123e4567-e89b-12d3-a456-426614174000'
					}
				}),
				route: { id: '/dashboard' },
				url: new URL('http://localhost/dashboard')
			},
			resolve: async () => new Response('ok', { status: 200 })
		});

		expect(response.status).toBe(200);
		expect(response.headers.get('x-request-id')).toBe('123e4567-e89b-12d3-a456-426614174000');
		expect(response.headers.get('X-Content-Type-Options')).toBe('nosniff');
		expect(response.headers.get('X-Frame-Options')).toBe('DENY');
		expect(response.headers.get('X-Permitted-Cross-Domain-Policies')).toBe('none');
		expect(response.headers.get('Referrer-Policy')).toBe('strict-origin-when-cross-origin');
		expect(cookies.setCalls).toEqual([
			{
				name: 'gyre_csrf',
				options: expect.objectContaining({ httpOnly: false, path: '/' }),
				value: 'csrf:session-1'
			}
		]);
		expect(observeCalls).toHaveLength(1);
	});

	test('returns JSON 413 for oversized API requests', async () => {
		const { handle } = await importHooks();

		const response = await handle({
			event: {
				cookies: createCookies(),
				getClientAddress: () => '127.0.0.1',
				locals: {} as App.Locals,
				request: new Request('http://localhost/api/v1/flux/version', {
					headers: { 'content-length': String(1024 * 1024 + 1) },
					method: 'POST'
				}),
				url: new URL('http://localhost/api/v1/flux/version')
			},
			resolve: async () => new Response('unreachable')
		});

		expect(response.status).toBe(413);
		expect(await response.json()).toEqual({
			error: 'Payload Too Large',
			message: 'Request payload exceeds maximum size of 1MB'
		});
	});

	test.each(['abc', '10abc', '10, 20', '-1', '1.5', 'Infinity', 'NaN', '9007199254740992'])(
		'returns JSON 400 for malformed Content-Length %p',
		async (contentLength) => {
			const { handle } = await importHooks();

			const response = await handle({
				event: {
					cookies: createCookies(),
					getClientAddress: () => '127.0.0.1',
					locals: {} as App.Locals,
					request: new Request('http://localhost/api/v1/flux/version', {
						headers: { 'content-length': contentLength },
						method: 'POST'
					}),
					url: new URL('http://localhost/api/v1/flux/version')
				},
				resolve: async () => new Response('unreachable')
			});

			expect(response.status).toBe(400);
			expect(await response.json()).toEqual({
				error: 'Bad Request',
				message: 'Malformed Content-Length header'
			});
		}
	);

	test('state-changing streamed request without Content-Length is rejected after exceeding limit', async () => {
		sessionData = {
			session: { id: 'session-1' },
			user: createUser()
		};
		const stream = new ReadableStream<Uint8Array>({
			start(controller) {
				controller.enqueue(new Uint8Array(1024 * 1024));
				controller.enqueue(new Uint8Array(1));
				controller.close();
			}
		});
		const { handle } = await importHooks();

		const response = await handle({
			event: {
				cookies: createCookies({ gyre_session: 'session-cookie' }),
				getClientAddress: () => '127.0.0.1',
				locals: {} as App.Locals,
				request: new Request('http://localhost/api/v1/flux/version', {
					body: stream,
					duplex: 'half',
					headers: { 'x-csrf-token': 'csrf:session-1' },
					method: 'POST'
				} as RequestInit),
				url: new URL('http://localhost/api/v1/flux/version')
			},
			resolve: async (event) => {
				await event.request.arrayBuffer();
				return new Response('unreachable');
			}
		});

		expect(response.status).toBe(413);
		expect(await response.json()).toEqual({
			error: 'Payload Too Large',
			message: 'Request payload exceeds maximum size of 1MB'
		});
	});

	test('redirects page/form payload-too-large responses back with _error', async () => {
		const { handle } = await importHooks();

		const response = await handle({
			event: {
				cookies: createCookies(),
				getClientAddress: () => '127.0.0.1',
				locals: {} as App.Locals,
				request: new Request('http://localhost/settings?tab=profile', {
					headers: { 'content-length': String(1024 * 1024 + 1) },
					method: 'POST'
				}),
				url: new URL('http://localhost/settings?tab=profile')
			},
			resolve: async () => new Response('unreachable')
		});

		expect(response.status).toBe(303);
		expect(response.headers.get('location')).toBe('/settings?tab=profile&_error=payload_too_large');
	});

	test('rejects authenticated state-changing requests with invalid csrf tokens', async () => {
		sessionData = {
			session: { id: 'session-1' },
			user: createUser()
		};
		csrfValid = false;
		const { handle } = await importHooks();

		const response = await handle({
			event: {
				cookies: createCookies({ gyre_session: 'session-cookie' }),
				getClientAddress: () => '127.0.0.1',
				locals: {} as App.Locals,
				request: new Request('http://localhost/api/v1/flux/version', { method: 'POST' }),
				url: new URL('http://localhost/api/v1/flux/version')
			},
			resolve: async () => new Response('unreachable')
		});

		expect(response.status).toBe(403);
		expect(await response.json()).toEqual({
			error: 'Forbidden',
			message: 'Invalid or missing CSRF token'
		});
	});

	test('returns 401 for unauthenticated API access', async () => {
		const { handle } = await importHooks();

		const response = await handle({
			event: {
				cookies: createCookies(),
				getClientAddress: () => '127.0.0.1',
				locals: {} as App.Locals,
				request: new Request('http://localhost/api/v1/flux/version'),
				url: new URL('http://localhost/api/v1/flux/version')
			},
			resolve: async () => new Response('unreachable')
		});

		expect(response.status).toBe(401);
		expect(await response.json()).toEqual({
			error: 'Unauthorized',
			message: 'Authentication required'
		});
	});

	test('redirects unauthenticated page access to login with a safe returnTo', async () => {
		const { handle } = await importHooks();

		const response = await handle({
			event: {
				cookies: createCookies(),
				getClientAddress: () => '127.0.0.1',
				locals: {} as App.Locals,
				request: new Request('http://localhost/dashboard?tab=2'),
				url: new URL('http://localhost/dashboard?tab=2')
			},
			resolve: async () => new Response('unreachable')
		});

		expect(response.status).toBe(302);
		expect(response.headers.get('location')).toBe('/login?returnTo=%2Fdashboard%3Ftab%3D2');
	});

	test('falls back to in-cluster when the cluster cookie is stale', async () => {
		sessionData = {
			session: { id: 'session-1' },
			user: createUser()
		};
		clusterRecord = null;
		const cookies = createCookies({
			gyre_cluster: 'stale-cluster',
			gyre_session: 'session-cookie'
		});
		const event = {
			cookies,
			getClientAddress: () => '127.0.0.1',
			locals: {} as App.Locals,
			request: new Request('http://localhost/dashboard'),
			url: new URL('http://localhost/dashboard')
		};
		const { handle } = await importHooks();

		const response = await handle({
			event,
			resolve: async () => new Response('ok', { status: 200 })
		});

		expect(response.status).toBe(200);
		expect(event.locals.cluster).toBe(IN_CLUSTER_ID);
		expect(cookies.deleted).toContainEqual({
			name: 'gyre_cluster',
			options: { path: '/' }
		});
	});

	test('defaults to in-cluster when the cluster cookie is missing', async () => {
		sessionData = {
			session: { id: 'session-1' },
			user: createUser()
		};
		const event = {
			cookies: createCookies({ gyre_session: 'session-cookie' }),
			getClientAddress: () => '127.0.0.1',
			locals: {} as App.Locals,
			request: new Request('http://localhost/dashboard'),
			url: new URL('http://localhost/dashboard')
		};
		const { handle } = await importHooks();

		const response = await handle({
			event,
			resolve: async () => new Response('ok', { status: 200 })
		});

		expect(response.status).toBe(200);
		expect(event.locals.cluster).toBe(IN_CLUSTER_ID);
		expect(getClusterByIdCalls).toEqual([]);
	});

	test('keeps a valid uploaded cluster id selected', async () => {
		sessionData = {
			session: { id: 'session-1' },
			user: createUser()
		};
		clusterRecord = { id: 'cluster-a', isActive: true };
		const event = {
			cookies: createCookies({
				gyre_cluster: 'cluster-a',
				gyre_session: 'session-cookie'
			}),
			getClientAddress: () => '127.0.0.1',
			locals: {} as App.Locals,
			request: new Request('http://localhost/dashboard'),
			url: new URL('http://localhost/dashboard')
		};
		const { handle } = await importHooks();

		const response = await handle({
			event,
			resolve: async () => new Response('ok', { status: 200 })
		});

		expect(response.status).toBe(200);
		expect(event.locals.cluster).toBe('cluster-a');
		expect(getClusterByIdCalls).toEqual(['cluster-a']);
		expect(event.cookies.deleted).toEqual([]);
	});

	test('treats context-name-like cookies as stale unless they match an active cluster id', async () => {
		sessionData = {
			session: { id: 'session-1' },
			user: createUser()
		};
		clusterRecord = null;
		const cookies = createCookies({
			gyre_cluster: 'kind-kind',
			gyre_session: 'session-cookie'
		});
		const event = {
			cookies,
			getClientAddress: () => '127.0.0.1',
			locals: {} as App.Locals,
			request: new Request('http://localhost/dashboard'),
			url: new URL('http://localhost/dashboard')
		};
		const { handle } = await importHooks();

		const response = await handle({
			event,
			resolve: async () => new Response('ok', { status: 200 })
		});

		expect(response.status).toBe(200);
		expect(getClusterByIdCalls).toEqual(['kind-kind']);
		expect(event.locals.cluster).toBe(IN_CLUSTER_ID);
		expect(cookies.deleted).toContainEqual({
			name: 'gyre_cluster',
			options: { path: '/' }
		});
	});

	test('keeps admin routes forbidden for non-admin users', async () => {
		sessionData = {
			session: { id: 'session-1' },
			user: createUser('editor')
		};
		const { handle } = await importHooks();

		const response = await handle({
			event: {
				cookies: createCookies({ gyre_session: 'session-cookie' }),
				getClientAddress: () => '127.0.0.1',
				locals: {} as App.Locals,
				request: new Request('http://localhost/api/v1/admin/settings'),
				url: new URL('http://localhost/api/v1/admin/settings')
			},
			resolve: async () => new Response('unreachable')
		});

		expect(response.status).toBe(403);
		expect(await response.json()).toEqual({
			error: 'Forbidden',
			message: 'Admin access required'
		});
	});

	test('maps unhandled API errors through the shared HTTP response formatter', async () => {
		sessionData = {
			session: { id: 'session-1' },
			user: createUser()
		};
		errorResponse = {
			status: 418,
			body: {
				error: 'Mapped Error',
				message: 'Mapped Error',
				code: 'MappedCode'
			}
		};
		const { handle } = await importHooks();

		const response = await handle({
			event: {
				cookies: createCookies({ gyre_session: 'session-cookie' }),
				getClientAddress: () => '127.0.0.1',
				locals: {} as App.Locals,
				request: new Request('http://localhost/api/v1/boom'),
				url: new URL('http://localhost/api/v1/boom')
			},
			resolve: async () => {
				throw new Error('boom');
			}
		});

		expect(response.status).toBe(418);
		expect(await response.json()).toEqual({
			error: 'Mapped Error',
			message: 'Mapped Error',
			code: 'MappedCode'
		});
	});
});
