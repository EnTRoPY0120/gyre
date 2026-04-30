import { error } from '@sveltejs/kit';
import * as audit from '$lib/server/audit.js';
import type { User } from '$lib/server/db/schema.js';
import { sanitizeK8sErrorMessage } from '$lib/server/kubernetes/errors.js';
import {
	getAllResourcePlurals,
	resolveFluxResourceType,
	type FluxResourceType
} from '$lib/server/kubernetes/flux/resources.js';
import { checkRateLimit, sseConnectionLimiter } from '$lib/server/rate-limiter.js';
import {
	checkClusterWideReadPermission,
	checkPermission,
	type RbacAction
} from '$lib/server/rbac.js';
import { validateK8sName, validateK8sNamespace } from '$lib/server/validation.js';

type RateLimitEvent = { setHeaders: (headers: Record<string, string>) => void };
type RateLimitPreset = 'admin' | 'batch' | 'preferences' | 'metrics';

const RATE_LIMIT_PRESETS = {
	admin: { limit: 20, windowMs: 60_000 },
	batch: { limit: 60, windowMs: 60_000 },
	preferences: { limit: 30, windowMs: 60_000 },
	metrics: { limit: 120, windowMs: 60_000 }
} satisfies Record<RateLimitPreset, { limit: number; windowMs: number }>;

export interface FluxRouteParams {
	resourceType: string;
	namespace: string;
	name: string;
}

export interface PrivilegedFluxResourceContext {
	clusterId: string;
	name: string;
	namespace: string;
	resourceType: FluxResourceType;
	user: User;
}

export interface PrivilegedAuditContext {
	action: 'reconcile' | 'suspend' | 'resume' | 'rollback' | 'delete' | string;
	clusterId?: string;
	details?: Record<string, unknown>;
	ipAddress?: string;
	name?: string;
	namespace?: string;
	resourceType?: string;
	user: User | null;
}

export function requireAuthenticatedUser(locals: App.Locals) {
	if (!locals.user) {
		throw error(401, { message: 'Authentication required' });
	}

	return locals.user;
}

export function requireClusterContext(locals: App.Locals) {
	if (!locals.cluster) {
		throw error(400, { message: 'Cluster context required' });
	}

	return locals.cluster;
}

export function enforceRateLimitPreset(
	event: RateLimitEvent,
	preset: RateLimitPreset,
	identifier: string
): void {
	const config = RATE_LIMIT_PRESETS[preset];
	checkRateLimit(event, `${preset}:${identifier}`, config.limit, config.windowMs);
}

export function enforceUserRateLimitPreset(
	event: RateLimitEvent,
	locals: App.Locals,
	preset: Exclude<RateLimitPreset, 'metrics'>
): User {
	requireAuthenticatedUser(locals);
	const user = locals.user;
	if (!user) {
		throw error(401, { message: 'Authentication required' });
	}
	enforceRateLimitPreset(event, preset, user.id);
	return user;
}

export function enforceMetricsRateLimit(event: RateLimitEvent, clientAddress: string): void {
	enforceRateLimitPreset(event, 'metrics', clientAddress);
}

export function acquireSseConnectionSlot(params: {
	maxPerSession: number;
	maxPerUser: number;
	sessionId: string;
	userId: string;
}) {
	return sseConnectionLimiter.acquire(
		params.sessionId,
		params.userId,
		params.maxPerSession,
		params.maxPerUser
	);
}

export async function requireClusterWideRead(locals: App.Locals): Promise<void> {
	const user = requireAuthenticatedUser(locals);
	const hasPermission = await checkClusterWideReadPermission(user, locals.cluster);

	if (!hasPermission) {
		throw error(403, { message: 'Permission denied' });
	}
}

export async function requireScopedPermission(
	locals: App.Locals,
	action: RbacAction,
	resourceType: string,
	namespace?: string
): Promise<void> {
	const user = requireAuthenticatedUser(locals);
	const hasPermission = await checkPermission(
		user,
		action,
		resourceType,
		namespace,
		locals.cluster
	);

	if (!hasPermission) {
		throw error(403, { message: 'Permission denied' });
	}
}

export async function requireAdminPermission(
	locals: App.Locals,
	resourceType?: string,
	namespace?: string
): Promise<void> {
	await requirePrivilegedAdminPermission(locals, resourceType, namespace);
}

export async function requirePrivilegedAdminPermission(
	locals: App.Locals,
	resourceType?: string,
	namespace?: string
): Promise<User> {
	const user = requireAuthenticatedUser(locals);

	const hasPermission = await checkPermission(
		user,
		'admin',
		resourceType,
		namespace,
		locals.cluster
	);
	if (!hasPermission) {
		throw error(403, { message: 'Admin access required' });
	}

	return user;
}

export function resolveFluxRouteResourceType(resourceType: string): FluxResourceType {
	const resolvedType = resolveFluxResourceType(resourceType);
	if (!resolvedType) {
		const validPlurals = getAllResourcePlurals();
		throw error(400, {
			message: `Invalid resource type: ${resourceType}. Valid types: ${validPlurals.join(', ')}`
		});
	}

	return resolvedType;
}

export function validateFluxRouteIdentity(namespace: string, name: string): void {
	validateK8sNamespace(namespace);
	validateK8sName(name);
}

export async function requireFluxResourcePermission(
	locals: App.Locals,
	params: FluxRouteParams,
	action: RbacAction
): Promise<PrivilegedFluxResourceContext> {
	const user = requireAuthenticatedUser(locals);
	const clusterId = requireClusterContext(locals);
	const { resourceType, namespace, name } = params;
	validateFluxRouteIdentity(namespace, name);
	const resolvedType = resolveFluxRouteResourceType(resourceType);

	const hasPermission = await checkPermission(user, action, resolvedType, namespace, clusterId);
	if (!hasPermission) {
		throw error(403, { message: 'Permission denied' });
	}

	return { user, clusterId, resourceType: resolvedType, namespace, name };
}

export function requireFluxResourceRead(
	locals: App.Locals,
	params: FluxRouteParams
): Promise<PrivilegedFluxResourceContext> {
	return requireFluxResourcePermission(locals, params, 'read');
}

export function requireFluxResourceWrite(
	locals: App.Locals,
	params: FluxRouteParams
): Promise<PrivilegedFluxResourceContext> {
	return requireFluxResourcePermission(locals, params, 'write');
}

export function requireFluxResourceAdmin(
	locals: App.Locals,
	params: FluxRouteParams
): Promise<PrivilegedFluxResourceContext> {
	return requireFluxResourcePermission(locals, params, 'admin');
}

export async function logPrivilegedMutationSuccess(context: PrivilegedAuditContext): Promise<void> {
	const actionName = context.action;
	const auditAction =
		actionName === 'reconcile' ||
		actionName === 'suspend' ||
		actionName === 'resume' ||
		actionName === 'rollback'
			? `write:${actionName}`
			: actionName;

	await audit.logAudit(context.user, auditAction, {
		resourceType: context.resourceType,
		resourceName: context.name,
		namespace: context.namespace,
		clusterId: context.clusterId,
		ipAddress: context.ipAddress,
		success: true,
		details: context.details
	});
}

export async function logPrivilegedMutationFailure(
	context: PrivilegedAuditContext & { error: unknown }
): Promise<void> {
	const actionName =
		context.action.startsWith('write:') || context.action.startsWith('admin:')
			? context.action
			: `write:${context.action}`;

	await audit.logAudit(context.user, actionName, {
		resourceType: context.resourceType,
		resourceName: context.name,
		namespace: context.namespace,
		clusterId: context.clusterId,
		ipAddress: context.ipAddress,
		success: false,
		details: {
			...context.details,
			error: sanitizeK8sErrorMessage(
				context.error instanceof Error ? context.error.message : String(context.error)
			)
		}
	});
}
