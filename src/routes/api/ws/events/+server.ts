import type { RequestHandler } from '@sveltejs/kit';
import { listFluxResources } from '$lib/server/kubernetes/client';
import type { FluxResourceType } from '$lib/server/kubernetes/flux/resources';

// Resource types to watch
const WATCH_RESOURCES: FluxResourceType[] = [
	'GitRepository',
	'HelmRepository',
	'Kustomization',
	'HelmRelease'
];

export const GET: RequestHandler = async ({ request }) => {
	// Create a ReadableStream for SSE
	const stream = new ReadableStream({
		start(controller) {
			// Send initial connection message
			const connectMsg = `data: ${JSON.stringify({
				type: 'CONNECTED',
				message: 'Connected to event stream',
				timestamp: new Date().toISOString()
			})}\n\n`;
			try {
				controller.enqueue(new TextEncoder().encode(connectMsg));
			} catch {
				// Controller may be closed, ignore
				return;
			}

			// Set up polling interval (since Kubernetes watch API requires persistent connection)
			// For MVP, we'll poll every 10 seconds and send updates
			const lastStates: Map<string, string> = new Map();
			let isActive = true;

			const pollResources = async () => {
				if (!isActive) return;

				try {
					for (const resourceType of WATCH_RESOURCES) {
						// Note: listFluxResources returns the raw item list, not { success: true, resources: [...] }
						// as I incorrectly assumed in the previous implementation.
						// Checking client.ts: return response as unknown as FluxResourceList;
						// FluxResourceList has { items: [] } structure.
						const resourceList = await listFluxResources(resourceType);

						if (resourceList && resourceList.items) {
							const currentMessageKeys = new Set<string>();

							for (const resource of resourceList.items) {
								const key = `${resourceType}/${resource.metadata.namespace}/${resource.metadata.name}`;
								currentMessageKeys.add(key);

								// Extract only relevant status fields to avoid noisy notifications
								// Extract only relevant status fields to avoid noisy notifications
								// We exclude timestamps (lastTransitionTime, lastUpdateTime) from the comparison
								const conditions = resource.status?.conditions?.map(
									(c: { type: string; status: string; reason?: string; message?: string }) => ({
										type: c.type,
										status: c.status,
										reason: c.reason,
										message: c.message
									})
								);

								const currentState = JSON.stringify({
									conditions,
									observedGeneration: resource.status?.observedGeneration,
									// Track revision changes
									revision:
										resource.status?.lastAppliedRevision ||
										resource.status?.artifact?.revision ||
										resource.status?.lastAttemptedRevision
								});

								const previousState = lastStates.get(key);

								// Detect ADDED
								if (!previousState && lastStates.size > 0) {
									const event = {
										type: 'ADDED',
										resourceType,
										resource: {
											metadata: {
												name: resource.metadata.name,
												namespace: resource.metadata.namespace,
												uid: resource.metadata.uid || 'unknown'
											},
											status: resource.status
										},
										timestamp: new Date().toISOString()
									};
									const msg = `data: ${JSON.stringify(event)}\n\n`;
									try {
										controller.enqueue(new TextEncoder().encode(msg));
									} catch {
										// Controller may be closed, ignore
									}
								}
								// Detect MODIFIED
								else if (previousState && previousState !== currentState) {
									const event = {
										type: 'MODIFIED',
										resourceType,
										resource: {
											metadata: {
												name: resource.metadata.name,
												namespace: resource.metadata.namespace,
												uid: resource.metadata.uid || 'unknown'
											},
											status: resource.status
										},
										timestamp: new Date().toISOString()
									};

									const msg = `data: ${JSON.stringify(event)}\n\n`;
									try {
										controller.enqueue(new TextEncoder().encode(msg));
									} catch {
										// Controller may be closed, ignore
									}
								}

								lastStates.set(key, currentState);
							}

							// Detect DELETED
							for (const key of lastStates.keys()) {
								if (key.startsWith(`${resourceType}/`) && !currentMessageKeys.has(key)) {
									const [type, namespace, name] = key.split('/');

									const event = {
										type: 'DELETED',
										resourceType: type,
										resource: {
											metadata: {
												name: name,
												namespace: namespace,
												uid: 'unknown'
											}
										},
										timestamp: new Date().toISOString()
									};
									const msg = `data: ${JSON.stringify(event)}\n\n`;
									try {
										controller.enqueue(new TextEncoder().encode(msg));
									} catch {
										// Controller may be closed, ignore
									}

									lastStates.delete(key);
								}
							}
						}
					}
				} catch (err) {
					console.error('[SSE] Error polling resources:', err);
				}

				// Schedule next poll
				if (isActive) {
					setTimeout(pollResources, 5000); // Poll every 5 seconds
				}
			};

			// Initial poll to establish baseline
			pollResources();

			// Send heartbeat every 30 seconds to keep connection alive
			const heartbeatInterval = setInterval(() => {
				if (!isActive) {
					clearInterval(heartbeatInterval);
					return;
				}

				try {
					const heartbeat = `data: ${JSON.stringify({
						type: 'HEARTBEAT',
						timestamp: new Date().toISOString()
					})}\n\n`;
					controller.enqueue(new TextEncoder().encode(heartbeat));
				} catch {
					// Controller may be closed, stop heartbeat
					clearInterval(heartbeatInterval);
				}
			}, 30000);

			// Handle client disconnect
			request.signal.addEventListener('abort', () => {
				isActive = false;
				clearInterval(heartbeatInterval);
				// Gracefully close the stream - ignore errors if already closed
				Promise.resolve().then(() => {
					try {
						controller.close();
					} catch {
						// Controller may already be closed
					}
				});
			});
		}
	});

	return new Response(stream, {
		headers: {
			'Content-Type': 'text/event-stream',
			'Cache-Control': 'no-cache',
			Connection: 'keep-alive'
		}
	});
};
