<script lang="ts">
	import type { FluxResource } from '$lib/types/flux';
	import { formatTimestamp } from '$lib/utils/flux';

	interface Props {
		resource: FluxResource;
	}

	let { resource }: Props = $props();

	// Extract GitRepository-specific fields
	const spec = $derived(resource.spec || {});
	const status = $derived(resource.status || {});

	const url = $derived(spec.url as string | undefined);
	const SAFE_URL_PROTOCOLS = ['http:', 'https:', 'ssh:', 'git:', 'oci:'];
	const isSafeUrl = $derived(
		!!url &&
			(() => {
				try {
					return SAFE_URL_PROTOCOLS.includes(new URL(url).protocol);
				} catch {
					return false;
				}
			})()
	);
	const interval = $derived(spec.interval as string | undefined);
	const timeout = $derived(spec.timeout as string | undefined);
	const ref = $derived(
		spec.ref as { branch?: string; tag?: string; semver?: string; commit?: string } | undefined
	);
	const secretRef = $derived(spec.secretRef as { name: string } | undefined);
	const ignore = $derived(spec.ignore as string | undefined);
	const suspend = $derived(spec.suspend as boolean | undefined);

	// Artifact info from status
	const artifact = $derived(
		status.artifact as
			| {
					path?: string;
					url?: string;
					revision?: string;
					lastUpdateTime?: string;
			  }
			| undefined
	);
</script>

<div class="space-y-6">
	<!-- Source & Sync Status -->
	<div class="rounded-lg border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800">
		<h3 class="mb-4 text-lg font-semibold text-gray-900 dark:text-gray-100">
			Source & Sync Status
		</h3>
		<dl class="grid gap-4 sm:grid-cols-2">
			{#if url}
				<div class="sm:col-span-2">
					<dt class="text-sm font-medium text-gray-500 dark:text-gray-400">Repository URL</dt>
					<dd class="mt-1">
						{#if isSafeUrl}
							<a
								href={url}
								target="_blank"
								rel="external noopener noreferrer"
								class="inline-flex items-center gap-1.5 text-sm text-blue-600 hover:underline dark:text-blue-400"
							>
								<svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
									<path
										stroke-linecap="round"
										stroke-linejoin="round"
										stroke-width="2"
										d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
									/>
								</svg>
								{url}
							</a>
						{:else}
							<span class="text-sm text-gray-900 dark:text-gray-100">{url}</span>
						{/if}
					</dd>
				</div>
			{/if}

			{#if ref}
				<div>
					<dt class="text-sm font-medium text-gray-500 dark:text-gray-400">Git Reference</dt>
					<dd class="mt-1 text-sm text-gray-900 dark:text-gray-100">
						{#if ref.branch}
							<span
								class="inline-flex items-center gap-1.5 rounded-md bg-purple-100 px-2 py-1 text-xs font-medium text-purple-800 dark:bg-purple-900/50 dark:text-purple-300"
							>
								<svg class="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
									<path
										stroke-linecap="round"
										stroke-linejoin="round"
										stroke-width="2"
										d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
									/>
								</svg>
								branch: {ref.branch}
							</span>
						{:else if ref.tag}
							<span
								class="inline-flex items-center gap-1.5 rounded-md bg-blue-100 px-2 py-1 text-xs font-medium text-blue-800 dark:bg-blue-900/50 dark:text-blue-300"
							>
								<svg class="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
									<path
										stroke-linecap="round"
										stroke-linejoin="round"
										stroke-width="2"
										d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z"
									/>
								</svg>
								tag: {ref.tag}
							</span>
						{:else if ref.semver}
							<span
								class="inline-flex items-center gap-1.5 rounded-md bg-green-100 px-2 py-1 text-xs font-medium text-green-800 dark:bg-green-900/50 dark:text-green-300"
							>
								semver: {ref.semver}
							</span>
						{:else if ref.commit}
							<span
								class="inline-flex items-center gap-1.5 rounded-md bg-gray-100 px-2 py-1 font-mono text-xs text-gray-800 dark:bg-gray-700 dark:text-gray-200"
							>
								{ref.commit.substring(0, 12)}
							</span>
						{/if}
					</dd>
				</div>
			{/if}

			{#if interval}
				<div>
					<dt class="text-sm font-medium text-gray-500 dark:text-gray-400">Sync Interval</dt>
					<dd class="mt-1 text-sm text-gray-900 dark:text-gray-100">{interval}</dd>
				</div>
			{/if}

			{#if artifact?.revision}
				<div class="sm:col-span-2 pt-4 mt-2 border-t border-gray-100 dark:border-gray-700">
					<dt class="text-sm font-medium text-gray-500 dark:text-gray-400">Currently Synced Revision</dt>
					<dd class="mt-1 font-mono text-sm text-gray-900 dark:text-gray-100">
						{artifact.revision}
					</dd>
				</div>
			{/if}

			{#if artifact?.lastUpdateTime}
				<div>
					<dt class="text-sm font-medium text-gray-500 dark:text-gray-400">Last Updated</dt>
					<dd class="mt-1 text-sm text-gray-900 dark:text-gray-100">
						{formatTimestamp(artifact.lastUpdateTime)}
					</dd>
				</div>
			{/if}

			{#if artifact?.path}
				<div>
					<dt class="text-sm font-medium text-gray-500 dark:text-gray-400">Artifact Path</dt>
					<dd class="mt-1 font-mono text-sm text-gray-900 dark:text-gray-100 truncate" title={artifact.path}>
						{artifact.path}
					</dd>
				</div>
			{/if}
		</dl>
	</div>

	<!-- Advanced Configuration -->
	{#if timeout || secretRef || suspend !== undefined || ignore}
		<div class="rounded-lg border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800">
			<h3 class="mb-4 text-lg font-semibold text-gray-900 dark:text-gray-100">Advanced Configuration</h3>
			<dl class="grid gap-4 sm:grid-cols-2">
				{#if timeout}
					<div>
						<dt class="text-sm font-medium text-gray-500 dark:text-gray-400">Timeout</dt>
						<dd class="mt-1 text-sm text-gray-900 dark:text-gray-100">{timeout}</dd>
					</div>
				{/if}

				{#if secretRef}
					<div>
						<dt class="text-sm font-medium text-gray-500 dark:text-gray-400">
							Authentication Secret
						</dt>
						<dd class="mt-1">
							<span
								class="inline-flex items-center gap-1 rounded-md bg-yellow-100 px-2 py-1 text-xs font-medium text-yellow-800 dark:bg-yellow-900/50 dark:text-yellow-300"
							>
								<svg class="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
									<path
										stroke-linecap="round"
										stroke-linejoin="round"
										stroke-width="2"
										d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z"
									/>
								</svg>
								{secretRef.name}
							</span>
						</dd>
					</div>
				{/if}

				{#if suspend !== undefined}
					<div>
						<dt class="text-sm font-medium text-gray-500 dark:text-gray-400">Suspended</dt>
						<dd class="mt-1">
							<span
								class="inline-flex rounded-md px-2 py-0.5 text-xs font-medium {suspend
									? 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
									: 'bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300'}"
							>
								{suspend ? 'Yes' : 'No'}
							</span>
						</dd>
					</div>
				{/if}
				
				{#if ignore}
					<div class="sm:col-span-2">
						<dt class="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">Ignore Patterns</dt>
						<dd>
							<pre class="overflow-auto rounded-lg bg-gray-50 p-3 text-sm text-gray-800 dark:bg-gray-900/50 dark:text-gray-200"><code>{ignore}</code></pre>
						</dd>
					</div>
				{/if}
			</dl>
		</div>
	{/if}
</div>