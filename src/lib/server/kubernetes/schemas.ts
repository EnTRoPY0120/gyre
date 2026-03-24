import { z } from '$lib/server/openapi';

/**
 * Opaque but structurally correct schema for a FluxCD/Kubernetes resource.
 * Uses passthrough() to allow extra Kubernetes metadata fields (resourceVersion, uid, labels, etc.).
 */
export const k8sFluxResourceSchema = z
	.object({
		apiVersion: z.string(),
		kind: z.string(),
		metadata: z
			.object({
				name: z.string(),
				namespace: z.string().optional()
			})
			.passthrough(),
		spec: z.record(z.string(), z.unknown()).optional(),
		status: z.record(z.string(), z.unknown()).optional()
	})
	.passthrough();

/**
 * Schema for a K8sEvent object as returned by getAllRecentEvents / getResourceEvents.
 * Matches the K8sEvent interface in src/lib/types/events.ts.
 */
export const k8sEventSchema = z
	.object({
		type: z.enum(['Normal', 'Warning']),
		reason: z.string(),
		message: z.string(),
		count: z.number(),
		firstTimestamp: z.string().nullable(),
		lastTimestamp: z.string().nullable(),
		involvedObject: z
			.object({
				kind: z.string(),
				name: z.string(),
				namespace: z.string(),
				uid: z.string()
			})
			.passthrough(),
		source: z.object({ component: z.string() })
	})
	.passthrough();
