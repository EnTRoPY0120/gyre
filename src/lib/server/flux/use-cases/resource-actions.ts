import { json } from '@sveltejs/kit';
import { getControllerLogs, type ReqCache } from '$lib/server/kubernetes/client.js';
import { handleApiError } from '$lib/server/kubernetes/errors.js';
import { reconcileResource, toggleSuspendResource } from '$lib/server/kubernetes/flux/actions.js';
import { captureReconciliation } from '$lib/server/kubernetes/flux/reconciliation-tracker.js';
import {
	logPrivilegedMutationFailure,
	logPrivilegedMutationSuccess,
	requireFluxResourceRead,
	requireFluxResourceWrite,
	type FluxRouteParams
} from '$lib/server/http/guards.js';

export type FluxResourceAction = 'reconcile' | 'suspend' | 'resume';

export interface FluxActionUseCaseParams {
	action: FluxResourceAction;
	getClientAddress: () => string;
	locals: App.Locals;
	params: FluxRouteParams;
}

const actionMessages = {
	reconcile: (name: string) => `Reconciliation triggered for ${name}`,
	suspend: (name: string) => `Suspended ${name}`,
	resume: (name: string) => `Resumed ${name}`
} satisfies Record<FluxResourceAction, (name: string) => string>;

export async function runFluxResourceAction({
	action,
	getClientAddress,
	locals,
	params
}: FluxActionUseCaseParams) {
	const context = await requireFluxResourceWrite(locals, params);
	const ipAddress = getClientAddress();

	try {
		if (action === 'reconcile') {
			await reconcileResource(
				context.resourceType,
				context.namespace,
				context.name,
				context.clusterId
			);

			try {
				await captureReconciliation({
					resourceType: context.resourceType,
					namespace: context.namespace,
					name: context.name,
					clusterId: context.clusterId,
					triggerType: 'manual',
					triggeredByUserId: context.user.id
				});
			} catch {
				// History capture is best-effort; don't fail the reconcile response.
			}
		} else {
			await toggleSuspendResource(
				context.resourceType,
				context.namespace,
				context.name,
				action === 'suspend',
				context.clusterId
			);
		}

		await logPrivilegedMutationSuccess({
			action,
			user: context.user,
			resourceType: context.resourceType,
			name: context.name,
			namespace: context.namespace,
			clusterId: context.clusterId,
			ipAddress
		});

		return json({ success: true, message: actionMessages[action](context.name) });
	} catch (err) {
		await logPrivilegedMutationFailure({
			action,
			user: context.user,
			resourceType: context.resourceType,
			name: context.name,
			namespace: context.namespace,
			clusterId: context.clusterId,
			ipAddress,
			error: err
		});

		handleApiError(
			err,
			`Error ${action === 'resume' ? 'resuming' : `${action}ing`} ${context.name}`
		);
	}
}

export async function getFluxResourceLogs({
	locals,
	params
}: {
	locals: App.Locals;
	params: FluxRouteParams;
}) {
	const context = await requireFluxResourceRead(locals, params);
	const reqCache: ReqCache = new Map();

	try {
		const logs = await getControllerLogs(
			context.resourceType,
			context.namespace,
			context.name,
			context.clusterId,
			reqCache
		);
		return json({ logs });
	} catch (err) {
		handleApiError(err, `Error fetching logs for ${context.name}`);
	}
}
