import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import {
	clearClusterSelectionCookie,
	getClusterSelectionPayload,
	setClusterSelectionCookie,
	validateSelectableClusterId
} from '$lib/server/clusters/selection.js';
import { IN_CLUSTER_ID } from '$lib/clusters/identity.js';
import { requireAuthenticatedUser } from '$lib/server/http/guards.js';

function requireUserWithUnauthorizedContract(locals: App.Locals) {
	try {
		return requireAuthenticatedUser(locals);
	} catch {
		throw error(401, { message: 'Authentication required', code: 'Unauthorized' });
	}
}

export const GET: RequestHandler = async ({ locals }) => {
	requireUserWithUnauthorizedContract(locals);

	const currentClusterId = locals.cluster
		? await validateSelectableClusterId(locals.cluster).catch(() => IN_CLUSTER_ID)
		: IN_CLUSTER_ID;
	return json(await getClusterSelectionPayload(currentClusterId));
};

export const PUT: RequestHandler = async ({ request, cookies, locals }) => {
	requireUserWithUnauthorizedContract(locals);

	let rawBody: unknown;
	try {
		rawBody = await request.json();
	} catch {
		throw error(400, { message: 'Invalid JSON', code: 'BadRequest' });
	}

	if (
		typeof rawBody !== 'object' ||
		rawBody === null ||
		typeof (rawBody as { clusterId?: unknown }).clusterId !== 'string'
	) {
		throw error(400, { message: 'clusterId is required', code: 'BadRequest' });
	}

	let currentClusterId: string;
	try {
		currentClusterId = await validateSelectableClusterId(
			(rawBody as { clusterId: string }).clusterId
		);
	} catch {
		throw error(404, { message: 'Cluster is not selectable', code: 'NotFound' });
	}

	setClusterSelectionCookie(cookies, currentClusterId);
	return json(await getClusterSelectionPayload(currentClusterId));
};

export const DELETE: RequestHandler = async ({ cookies, locals }) => {
	requireUserWithUnauthorizedContract(locals);

	clearClusterSelectionCookie(cookies);
	return json(await getClusterSelectionPayload(IN_CLUSTER_ID));
};
