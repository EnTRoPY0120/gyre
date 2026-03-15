import { register } from '$lib/server/metrics';
import { GYRE_METRICS_TOKEN } from '$lib/server/config/constants';
import { checkRateLimit } from '$lib/server/rate-limiter';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ request, locals, setHeaders, getClientAddress }) => {
	checkRateLimit({ setHeaders }, `metrics:${getClientAddress()}`, 120, 60 * 1000);

	// Accept requests that supply a valid bearer token OR come from an authenticated admin session.
	const authHeader = request.headers.get('authorization') ?? '';
	const hasValidToken = GYRE_METRICS_TOKEN && authHeader === `Bearer ${GYRE_METRICS_TOKEN}`;
	const hasAdminSession = locals.user?.role === 'admin';
	if (!hasValidToken && !hasAdminSession) {
		return new Response(JSON.stringify({ error: 'Unauthorized' }), {
			status: 401,
			headers: { 'Content-Type': 'application/json' }
		});
	}

	const metrics = await register.metrics();
	const contentType = register.contentType;

	return new Response(metrics, {
		headers: {
			'Content-Type': contentType
		}
	});
};
