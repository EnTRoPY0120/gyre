import client from 'prom-client';

// Create a Registry which registers the metrics
const register = new client.Registry();

// Add a default label which is added to all metrics
register.setDefaultLabels({
	app: 'gyre'
});

// Enable the collection of default metrics
client.collectDefaultMetrics({ register });

// --- Metrics Definitions ---

// HTTP Request Duration
export const httpRequestDurationMicroseconds = new client.Histogram({
	name: 'gyre_http_request_duration_seconds',
	help: 'Duration of HTTP requests in seconds',
	labelNames: ['method', 'route', 'status_code'],
	buckets: [0.1, 0.5, 1, 2, 5]
});

// Login Attempts
export const loginAttemptsTotal = new client.Counter({
	name: 'gyre_login_attempts_total',
	help: 'Total number of login attempts',
	labelNames: ['status'] // 'success' | 'failure'
});

// Resource Polling Counts
export const resourcePollsTotal = new client.Counter({
	name: 'gyre_resource_polls_total',
	help: 'Total number of resource polling operations',
	labelNames: ['cluster_id', 'resource_type', 'status'] // status: 'success' | 'error'
});

// Resource Updates Detected
export const resourceUpdatesTotal = new client.Counter({
	name: 'gyre_resource_updates_total',
	help: 'Total number of resource updates detected',
	labelNames: ['cluster_id', 'resource_type', 'change_type'] // change_type: 'added' | 'modified' | 'deleted'
});

// Register all metrics
register.registerMetric(httpRequestDurationMicroseconds);
register.registerMetric(loginAttemptsTotal);
register.registerMetric(resourcePollsTotal);
register.registerMetric(resourceUpdatesTotal);

// Export registry for the endpoint
export { register };
