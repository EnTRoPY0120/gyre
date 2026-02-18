<script lang="ts">
	import type { FluxResource } from '$lib/types/flux';
	import { formatTimestamp } from '$lib/utils/flux';

	interface Props {
		resource: FluxResource;
	}

	let { resource }: Props = $props();

	const spec = $derived(resource.spec || {});
	const status = $derived(resource.status || {});

	const image = $derived(spec.image as string | undefined);
	const interval = $derived(spec.interval as string | undefined);
	const timeout = $derived(spec.timeout as string | undefined);
	const secretRef = $derived(spec.secretRef as { name: string } | undefined);
	const certSecretRef = $derived(spec.certSecretRef as { name: string } | undefined);
	const serviceAccountName = $derived(spec.serviceAccountName as string | undefined);
	const provider = $derived(spec.provider as string | undefined);
	const exclusionList = $derived(spec.exclusionList as string[] | undefined);
	const suspend = $derived(spec.suspend as boolean | undefined);
	const accessFrom = $derived(
		spec.accessFrom as { namespaceSelectors?: Array<{ matchLabels?: Record<string, string> }> } | undefined
	);

	// Status fields
	const lastScanResult = $derived(
		(status as Record<string, unknown>).lastScanResult as
			| { scanTime?: string; tagCount?: number; latestTags?: string[] }
			| undefined
	);
	const canonicalImageName = $derived(
		(status as Record<string, unknown>).canonicalImageName as string | undefined
	);
</script>

<div class="space-y-6">
	<!-- Image Configuration -->
	<div class="rounded-lg border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800">
		<h3 class="mb-4 text-lg font-semibold text-gray-900 dark:text-gray-100">
			Image Configuration
		</h3>
		<dl class="grid gap-4 sm:grid-cols-2">
			{#if image}
				<div class="sm:col-span-2">
					<dt class="text-sm font-medium text-gray-500 dark:text-gray-400">Image Repository</dt>
					<dd class="mt-1">
						<span
							class="inline-flex items-center gap-1.5 font-mono text-sm text-gray-900 dark:text-gray-100"
						>
							<svg
								class="h-4 w-4 text-indigo-500"
								fill="none"
								stroke="currentColor"
								viewBox="0 0 24 24"
							>
								<path
									stroke-linecap="round"
									stroke-linejoin="round"
									stroke-width="2"
									d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"
								/>
							</svg>
							{image}
						</span>
					</dd>
				</div>
			{/if}

			{#if canonicalImageName && canonicalImageName !== image}
				<div class="sm:col-span-2">
					<dt class="text-sm font-medium text-gray-500 dark:text-gray-400">
						Canonical Image Name
					</dt>
					<dd class="mt-1 font-mono text-sm text-gray-900 dark:text-gray-100">
						{canonicalImageName}
					</dd>
				</div>
			{/if}

			{#if interval}
				<div>
					<dt class="text-sm font-medium text-gray-500 dark:text-gray-400">Scan Interval</dt>
					<dd class="mt-1 text-sm text-gray-900 dark:text-gray-100">{interval}</dd>
				</div>
			{/if}

			{#if timeout}
				<div>
					<dt class="text-sm font-medium text-gray-500 dark:text-gray-400">Timeout</dt>
					<dd class="mt-1 text-sm text-gray-900 dark:text-gray-100">{timeout}</dd>
				</div>
			{/if}

			{#if provider}
				<div>
					<dt class="text-sm font-medium text-gray-500 dark:text-gray-400">Cloud Provider</dt>
					<dd class="mt-1">
						<span
							class="inline-flex items-center rounded-md bg-cyan-100 px-2 py-1 text-xs font-medium text-cyan-800 dark:bg-cyan-900/50 dark:text-cyan-300"
						>
							{provider}
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
		</dl>
	</div>

	<!-- Last Scan Results -->
	{#if lastScanResult}
		<div
			class="rounded-lg border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800"
		>
			<h3 class="mb-4 text-lg font-semibold text-gray-900 dark:text-gray-100">
				Last Scan Results
			</h3>
			<dl class="grid gap-4 sm:grid-cols-2">
				{#if lastScanResult.tagCount !== undefined}
					<div>
						<dt class="text-sm font-medium text-gray-500 dark:text-gray-400">Tags Found</dt>
						<dd class="mt-1">
							<span
								class="inline-flex items-center rounded-md bg-blue-100 px-2.5 py-1 text-lg font-bold text-blue-800 dark:bg-blue-900/50 dark:text-blue-300"
							>
								{lastScanResult.tagCount}
							</span>
						</dd>
					</div>
				{/if}

				{#if lastScanResult.scanTime}
					<div>
						<dt class="text-sm font-medium text-gray-500 dark:text-gray-400">Last Scan Time</dt>
						<dd class="mt-1 text-sm text-gray-900 dark:text-gray-100">
							{formatTimestamp(lastScanResult.scanTime)}
						</dd>
					</div>
				{/if}
			</dl>

			{#if lastScanResult.latestTags && lastScanResult.latestTags.length > 0}
				<div class="mt-4">
					<h4 class="mb-2 text-sm font-medium text-gray-500 dark:text-gray-400">Latest Tags</h4>
					<div class="flex flex-wrap gap-2">
						{#each lastScanResult.latestTags.slice(0, 20) as tag (tag)}
							<span
								class="inline-flex items-center rounded-md bg-emerald-100 px-2 py-1 font-mono text-xs text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-300"
							>
								{tag}
							</span>
						{/each}
						{#if lastScanResult.latestTags.length > 20}
							<span class="text-xs text-gray-500 dark:text-gray-400">
								+{lastScanResult.latestTags.length - 20} more
							</span>
						{/if}
					</div>
				</div>
			{/if}
		</div>
	{/if}

	<!-- Authentication -->
	{#if secretRef || certSecretRef || serviceAccountName}
		<div
			class="rounded-lg border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800"
		>
			<h3 class="mb-4 text-lg font-semibold text-gray-900 dark:text-gray-100">Authentication</h3>
			<dl class="grid gap-4 sm:grid-cols-2">
				{#if secretRef}
					<div>
						<dt class="text-sm font-medium text-gray-500 dark:text-gray-400">Registry Secret</dt>
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
				{#if serviceAccountName}
					<div>
						<dt class="text-sm font-medium text-gray-500 dark:text-gray-400">Service Account</dt>
						<dd class="mt-1">
							<span
								class="inline-flex items-center gap-1 rounded-md bg-purple-100 px-2 py-1 text-xs font-medium text-purple-800 dark:bg-purple-900/50 dark:text-purple-300"
							>
								{serviceAccountName}
							</span>
						</dd>
					</div>
				{/if}
			</dl>
		</div>
	{/if}

	<!-- Exclusion Patterns -->
	{#if exclusionList && exclusionList.length > 0}
		<div
			class="rounded-lg border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800"
		>
			<h3 class="mb-4 text-lg font-semibold text-gray-900 dark:text-gray-100">
				Tag Exclusion Patterns
			</h3>
			<div class="flex flex-wrap gap-2">
				{#each exclusionList as pattern (pattern)}
					<span
						class="inline-flex items-center rounded-md bg-red-100 px-2 py-1 font-mono text-xs text-red-800 dark:bg-red-900/50 dark:text-red-300"
					>
						{pattern}
					</span>
				{/each}
			</div>
		</div>
	{/if}
</div>
