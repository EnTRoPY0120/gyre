import { register } from '$lib/server/metrics';
import { GYRE_METRICS_TOKEN } from '$lib/server/config/constants';
import { checkRateLimit } from '$lib/server/rate-limiter';
import { checkPermission } from '$lib/server/rbac.js';
import { IS_PROD } from '$lib/server/config';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ request, setHeaders, getClientAddress, locals }) => {
	checkRateLimit({ setHeaders }, `metrics:${getClientAddress()}`, 120, 60 * 1000);

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

			const hasAdminPermission = await checkPermission(
				locals.user,
				'admin',
				undefined,
				undefined,
				locals.cluster
			);
			if (!hasAdminPermission) {
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
