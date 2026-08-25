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

type MetricsLocals = Parameters<typeof requirePrivilegedAdminPermission>[0];

function jsonError(message: string, status: number): Response {
	return new Response(JSON.stringify({ error: message }), {
		status,
		headers: { 'Content-Type': 'application/json' }
	});
}

function hasValidBearerToken(authHeader: string, metricsToken: string | undefined): boolean {
	return Boolean(metricsToken) && authHeader === `Bearer ${metricsToken}`;
}

async function authorizeProductionMetrics(
	authHeader: string,
	metricsToken: string | undefined,
	locals: MetricsLocals
): Promise<Response | null> {
	if (!metricsToken) return jsonError('Metrics token is not configured', 503);
	if (hasValidBearerToken(authHeader, metricsToken)) return null;
	if (!locals.user) return jsonError('Unauthorized', 401);

	try {
		await requirePrivilegedAdminPermission(locals);
		return null;
	} catch (err) {
		if (!isPermissionError(err)) throw err;
		return jsonError('Forbidden', 403);
	}
}

function authorizeDevelopmentMetrics(
	authHeader: string,
	metricsToken: string | undefined
): Response | null {
	return metricsToken && !hasValidBearerToken(authHeader, metricsToken)
		? jsonError('Unauthorized', 401)
		: null;
}

export const GET: RequestHandler = async ({ request, setHeaders, getClientAddress, locals }) => {
	enforceMetricsRateLimit({ setHeaders }, getClientAddress());

	const authHeader = request.headers.get('authorization') ?? '';
	const metricsToken = GYRE_METRICS_TOKEN?.trim();
	const authResponse = IS_PROD
		? await authorizeProductionMetrics(authHeader, metricsToken, locals)
		: authorizeDevelopmentMetrics(authHeader, metricsToken);
	if (authResponse) return authResponse;

	const metrics = await register.metrics();
	const contentType = register.contentType;

	return new Response(metrics, {
		headers: {
			'Content-Type': contentType
		}
	});
};
