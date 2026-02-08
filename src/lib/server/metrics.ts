import client from 'prom-client';

// Use a global variable to persist the registry across HMR during development
const globalRegistry = globalThis as unknown as { __gyre_metrics_register?: client.Registry };

if (!globalRegistry.__gyre_metrics_register) {
	globalRegistry.__gyre_metrics_register = new client.Registry();

	// Add a default label which is added to all metrics
	globalRegistry.__gyre_metrics_register.setDefaultLabels({
		app: 'gyre'
	});

	// Enable the collection of default metrics
	client.collectDefaultMetrics({ register: globalRegistry.__gyre_metrics_register });
}

export const register = globalRegistry.__gyre_metrics_register;

// Helper to get or create a metric
function getOrCreateCounter(config: client.CounterConfiguration<string>) {
	const existing = register.getSingleMetric(config.name);
	if (existing) return existing as client.Counter<string>;
	return new client.Counter({ ...config, registers: [register] });
}

function getOrCreateHistogram(config: client.HistogramConfiguration<string>) {
	const existing = register.getSingleMetric(config.name);
	if (existing) return existing as client.Histogram<string>;
	return new client.Histogram({ ...config, registers: [register] });
}

function getOrCreateGauge(config: client.GaugeConfiguration<string>) {
	const existing = register.getSingleMetric(config.name);
	if (existing) return existing as client.Gauge<string>;
	return new client.Gauge({ ...config, registers: [register] });
}

// --- Metrics Definitions ---

// HTTP Request Duration
export const httpRequestDurationMicroseconds = getOrCreateHistogram({
	name: 'gyre_http_request_duration_seconds',
	help: 'Duration of HTTP requests in seconds',
	labelNames: ['method', 'route', 'status_code'],
	buckets: [0.1, 0.5, 1, 2, 5]
});

// Login Attempts
export const loginAttemptsTotal = getOrCreateCounter({
	name: 'gyre_login_attempts_total',
	help: 'Total number of login attempts',
	labelNames: ['status'] // 'success' | 'failure'
});

// Resource Polling Counts
export const resourcePollsTotal = getOrCreateCounter({
	name: 'gyre_resource_polls_total',
	help: 'Total number of resource polling operations',
	labelNames: ['cluster_id', 'resource_type', 'status'] // status: 'success' | 'error'
});

// Resource Updates Detected
export const resourceUpdatesTotal = getOrCreateCounter({
	name: 'gyre_resource_updates_total',
	help: 'Total number of resource updates detected',
	labelNames: ['cluster_id', 'resource_type', 'change_type'] // change_type: 'added' | 'modified' | 'deleted'
});

// SSE Subscribers
export const sseSubscribersGauge = getOrCreateGauge({
	name: 'gyre_sse_subscribers_total',
	help: 'Current number of active SSE subscribers',
	labelNames: ['cluster_id']
});

// Active Polling Workers
export const activeWorkersGauge = getOrCreateGauge({
	name: 'gyre_active_workers_total',
	help: 'Current number of active cluster polling workers'
});

// Flux Resource Status
export const fluxResourceStatusGauge = getOrCreateGauge({
	name: 'gyre_flux_resource_status',
	help: 'Current status of Flux resources',
	labelNames: ['cluster_id', 'resource_type', 'namespace', 'name', 'status'] // status: 'Ready' | 'NotReady' | 'Unknown'
});
