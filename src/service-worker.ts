/// <reference types="@sveltejs/kit" />
/// <reference lib="webworker" />
import { build, files, version } from '$service-worker';

const CACHE = `cache-${version}`;

const ASSETS = [
	...build, // the app itself
	...files // everything in `static`
];

self.addEventListener('install', (event) => {
	const extendableEvent = event as ExtendableEvent;
	// Create a new cache and add all files to it
	async function addFilesToCache() {
		const cache = await caches.open(CACHE);
		await cache.addAll(ASSETS);
	}

	extendableEvent.waitUntil(addFilesToCache());
});

self.addEventListener('activate', (event) => {
	const extendableEvent = event as ExtendableEvent;
	// Remove previous cached data from disk
	async function deleteOldCaches() {
		for (const key of await caches.keys()) {
			if (key !== CACHE) await caches.delete(key);
		}
	}

	extendableEvent.waitUntil(deleteOldCaches());
});

function isStaticAsset(pathname: string): boolean {
	return (
		!pathname.startsWith('/api/') &&
		(ASSETS.includes(pathname) ||
			pathname.startsWith('/_app/') ||
			/\.(js|css|png|jpg|jpeg|gif|svg|ico|woff|woff2|ttf|eot)$/.test(pathname))
	);
}

async function getCachedAsset(cache: Cache, pathname: string): Promise<Response | undefined> {
	if (!ASSETS.includes(pathname)) return undefined;
	return cache.match(pathname);
}

async function fetchAndCache(
	request: Request,
	cache: Cache,
	event: FetchEvent,
	pathname: string
): Promise<Response> {
	const response = await fetch(request);

	// if we're offline, fetch can return a value that looks like it's 'ok' but has status 0.
	// that's not a real response, so throwback to the catch
	if (!(response instanceof Response)) {
		throw new Error('invalid response from fetch');
	}

	if (response.status === 200 && isStaticAsset(pathname)) {
		event.waitUntil(cache.put(request, response.clone()));
	}

	return response;
}

async function respond(event: FetchEvent): Promise<Response> {
	const url = new URL(event.request.url);
	const cache = await caches.open(CACHE);
	const cachedAsset = await getCachedAsset(cache, url.pathname);

	if (cachedAsset) return cachedAsset;

	try {
		return await fetchAndCache(event.request, cache, event, url.pathname);
	} catch (error) {
		const cachedResponse = await cache.match(event.request);

		if (cachedResponse) return cachedResponse;

		// if there's no cache, then it's a real error
		throw error;
	}
}

self.addEventListener('fetch', (event) => {
	const fetchEvent = event as FetchEvent;
	// ignore POST requests etc
	if (fetchEvent.request.method !== 'GET') return;
	fetchEvent.respondWith(respond(fetchEvent));
});
