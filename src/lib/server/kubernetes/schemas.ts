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
 * Schema for a Kubernetes Event object.
 */
export const k8sEventSchema = z
	.object({
		apiVersion: z.string(),
		kind: z.string(),
		metadata: z.object({ name: z.string(), namespace: z.string() }).passthrough(),
		type: z.string().optional(),
		reason: z.string().optional(),
		message: z.string().optional(),
		count: z.number().optional(),
		firstTimestamp: z.string().nullable().optional(),
		lastTimestamp: z.string().nullable().optional(),
		involvedObject: z
			.object({
				kind: z.string(),
				name: z.string(),
				namespace: z.string().optional()
			})
			.passthrough()
	})
	.passthrough();
