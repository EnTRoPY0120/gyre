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

// Global state tracking to persist across SSE connections
// This prevents duplicate notifications when clients reconnect
const globalLastStates: Map<string, string> = new Map();
const globalLastNotificationStates: Map<string, string> = new Map();
const resourceFirstSeen: Map<string, number> = new Map();
const SETTLING_PERIOD_MS = 30000; // Don't notify for 30s after first seeing a resource

// Helper to extract revision/SHA from resource status
function getResourceRevision(resource: any): string {
	return (
		resource.status?.lastAppliedRevision ||
		resource.status?.artifact?.revision ||
		resource.status?.lastAttemptedRevision ||
		''
	);
}

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
			// Use global maps for state tracking to persist across reconnections
			let isActive = true;

			const pollResources = async () => {
				if (!isActive) return;

				try {
					for (const resourceType of WATCH_RESOURCES) {
						const resourceList = await listFluxResources(resourceType);

						if (resourceList && resourceList.items) {
							const currentMessageKeys = new Set<string>();

							for (const resource of resourceList.items) {
								const key = `${resourceType}/${resource.metadata.namespace}/${resource.metadata.name}`;
								currentMessageKeys.add(key);

								// Extract only relevant status fields to avoid noisy notifications
								const conditions = resource.status?.conditions?.map(
									(c: { type: string; status: string; reason?: string; message?: string }) => ({
										type: c.type,
										status: c.status,
										reason: c.reason,
										message: c.message
									})
								);

								// Use resourceVersion as the primary indicator of change
								const currentState = JSON.stringify({
									resourceVersion: resource.metadata?.resourceVersion,
									generation: resource.metadata?.generation,
									observedGeneration: resource.status?.observedGeneration
								});

								// For MODIFIED events, track "notification-worthy" state separately
								// Focus on actual meaningful changes: revision/SHA and ready state
								const readyCondition = conditions?.find(
									(c: { type: string }) => c.type === 'Ready'
								);
								const revision = getResourceRevision(resource);

								// Build a stable notification state that focuses on actual changes
								const notificationState = JSON.stringify({
									revision: revision, // Primary indicator of actual change
									readyStatus: readyCondition?.status,
									readyReason: readyCondition?.reason,
									// Include first 100 chars of message to detect meaningful message changes
									messagePreview: readyCondition?.message?.substring(0, 100) || ''
								});

								const previousState = globalLastStates.get(key);

								// Track when we first saw this resource
								const now = Date.now();
								if (!resourceFirstSeen.has(key)) {
									resourceFirstSeen.set(key, now);
								}
								const firstSeen = resourceFirstSeen.get(key) || now;
								const isSettled = now - firstSeen > SETTLING_PERIOD_MS;

								// Detect ADDED
								if (!previousState) {
									// Only notify if settled (not during initial load)
									if (isSettled) {
										console.log(`[SSE] ADDED: ${key} with revision ${revision || 'none'}`);
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
									} else {
										console.log(
											`[SSE] INITIAL: ${key} with revision ${revision || 'none'} (settling period)`
										);
									}
									// Always update state cache, even during settling period
									globalLastNotificationStates.set(key, notificationState);
								}
								// Detect MODIFIED
								else if (previousState && previousState !== currentState) {
									const previousNotificationState = globalLastNotificationStates.get(key);

									// Only send MODIFIED event if the notification-worthy state changed
									if (
										!previousNotificationState ||
										previousNotificationState !== notificationState
									) {
										// Parse to see what actually changed
										const prevState = previousNotificationState
											? JSON.parse(previousNotificationState)
											: {};
										const currState = JSON.parse(notificationState);

										// Determine if this is a meaningful change worth notifying about
										const revisionChanged = prevState.revision !== currState.revision;
										const becameFailed = currState.readyStatus === 'False';
										const becameHealthy =
											prevState.readyStatus === 'False' && currState.readyStatus === 'True';
										const isTransientState = currState.readyStatus === 'Unknown';

										// Only notify if:
										// 1. Revision actually changed (new deployment), OR
										// 2. Status changed to False (failure), OR
										// 3. Recovered from False to True (recovery)
										// Skip notifications for transient "Unknown" states during reconciliation
										const shouldNotify =
											revisionChanged || becameFailed || (becameHealthy && revisionChanged);

										if (shouldNotify && !isTransientState) {
											console.log(
												`[SSE] MODIFIED: ${key} - revision changed from "${prevState.revision || 'none'}" to "${currState.revision || 'none'}", ready: ${currState.readyStatus}`
											);

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
										} else {
											// Skipping transient or non-meaningful state change
											const reason = isTransientState
												? 'transient Unknown state'
												: !revisionChanged
													? 'revision unchanged'
													: 'non-critical state change';
											console.log(
												`[SSE] SKIPPED: ${key} - ${reason} (revision: ${currState.revision || 'none'}, ready: ${currState.readyStatus})`
											);
										}

										// Always update the notification state cache
										globalLastNotificationStates.set(key, notificationState);
									} else {
										// State changed but notification-worthy state didn't
										// This is expected for metadata-only changes
										const currState = JSON.parse(notificationState);
										console.log(
											`[SSE] SKIPPED: ${key} - state changed but notification-worthy fields unchanged (revision: ${currState.revision || 'none'})`
										);
									}
								}

								globalLastStates.set(key, currentState);
							}

							// Detect DELETED
							for (const key of globalLastStates.keys()) {
								if (key.startsWith(`${resourceType}/`) && !currentMessageKeys.has(key)) {
									const [type, namespace, name] = key.split('/');

									console.log(`[SSE] DELETED: ${key}`);

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

									globalLastStates.delete(key);
									globalLastNotificationStates.delete(key);
									resourceFirstSeen.delete(key);
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
