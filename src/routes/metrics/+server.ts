import { register } from '$lib/server/metrics';
import { GYRE_METRICS_TOKEN } from '$lib/server/config/constants';
import { IS_PROD } from '$lib/server/config';
import {
	enforceMetricsRateLimit,
	requirePrivilegedAdminPermission
} from '$lib/server/http/guards.js';
import type { RequestHandler } from './$types';

function isPermissionError(err: unknown): boolean {
	return (
		err !== null &&
		typeof err === 'object' &&
		'status' in err &&
		(err as { status: unknown }).status === 403
	);
}

export const GET: RequestHandler = async ({ request, setHeaders, getClientAddress, locals }) => {
	enforceMetricsRateLimit({ setHeaders }, getClientAddress());

	const authHeader = request.headers.get('authorization') ?? '';
	const metricsToken = GYRE_METRICS_TOKEN?.trim();
	const hasValidBearerToken = !!metricsToken && authHeader === `Bearer ${metricsToken}`;

	if (IS_PROD) {
		if (!metricsToken) {
			return new Response(JSON.stringify({ error: 'Metrics token is not configured' }), {
				status: 503,
				headers: { 'Content-Type': 'application/json' }
			});
		}

		if (!hasValidBearerToken) {
			if (!locals.user) {
				return new Response(JSON.stringify({ error: 'Unauthorized' }), {
					status: 401,
					headers: { 'Content-Type': 'application/json' }
				});
			}

			try {
				await requirePrivilegedAdminPermission(locals);
			} catch (err) {
				if (!isPermissionError(err)) {
					throw err;
				}

				return new Response(JSON.stringify({ error: 'Forbidden' }), {
					status: 403,
					headers: { 'Content-Type': 'application/json' }
				});
			}
		}
	} else if (metricsToken) {
		if (authHeader !== `Bearer ${metricsToken}`) {
			return new Response(JSON.stringify({ error: 'Unauthorized' }), {
				status: 401,
				headers: { 'Content-Type': 'application/json' }
			});
		}
	}

	const metrics = await register.metrics();
	const contentType = register.contentType;

	return new Response(metrics, {
		headers: {
			'Content-Type': contentType
		}
	});
};
