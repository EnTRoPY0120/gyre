/// <reference types="@sveltejs/kit" />
/// <reference lib="webworker" />

// Keep this retirement worker at the existing URL so installed versions can
// update. New clients use ordinary HTTP caching and do not register a worker.
const worker = self as unknown as ServiceWorkerGlobalScope;

async function isLegacyGyreCache(cache: Cache): Promise<boolean> {
	const manifestUrl = new URL('manifest.json', worker.registration.scope);
	const response = await cache.match(manifestUrl.href);
	if (!response) return false;

	const manifest = await response.json();
	if (manifest.name !== 'Gyre - FluxCD Dashboard' || manifest.short_name !== 'Gyre') return false;

	const assetPrefix = new URL('_app/', worker.registration.scope);
	return (await cache.keys()).some((request) => {
		const url = new URL(request.url);
		return url.origin === assetPrefix.origin && url.pathname.startsWith(assetPrefix.pathname);
	});
}

async function clearLegacyGyreCaches(): Promise<void> {
	// Old cache names were generic. Identify their contents before deleting;
	// unrelated caches on the same origin must survive this upgrade.
	for (const name of await caches.keys()) {
		if (!name.startsWith('cache-')) continue;
		try {
			if (await isLegacyGyreCache(await caches.open(name))) await caches.delete(name);
		} catch {
			// An unreadable or malformed cache is not sufficient proof of ownership.
		}
	}
}

worker.addEventListener('install', (event) => {
	event.waitUntil(worker.skipWaiting());
});

worker.addEventListener('activate', (event) => {
	event.waitUntil(
		(async () => {
			await worker.clients.claim();
			try {
				await clearLegacyGyreCaches();
			} catch {
				// Storage failures must not prevent retirement of request interception.
			}
			await worker.registration.unregister();
		})()
	);
});
