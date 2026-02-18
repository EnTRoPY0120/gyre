<script lang="ts">
	import type { FluxResource } from '$lib/types/flux';
	import { formatTimestamp } from '$lib/utils/flux';

	interface Props {
		resource: FluxResource;
	}

	let { resource }: Props = $props();

	// Extract Bucket-specific fields
	const spec = $derived(resource.spec || {});
	const status = $derived(resource.status || {});

	const bucketName = $derived(spec.bucketName as string | undefined);
	const endpoint = $derived(spec.endpoint as string | undefined);
	const region = $derived(spec.region as string | undefined);
	const provider = $derived((spec.provider as string | undefined) || 'generic');
	const prefix = $derived(spec.prefix as string | undefined);
	const interval = $derived(spec.interval as string | undefined);
	const timeout = $derived(spec.timeout as string | undefined);
	const insecure = $derived(spec.insecure as boolean | undefined);
	const secretRef = $derived(spec.secretRef as { name: string } | undefined);
	const suspend = $derived(spec.suspend as boolean | undefined);
	const ignore = $derived(spec.ignore as string | undefined);

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
	<!-- Bucket Configuration -->
	<div class="rounded-lg border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800">
		<h3 class="mb-4 text-lg font-semibold text-gray-900 dark:text-gray-100">
			Bucket Configuration
		</h3>
		<dl class="grid gap-4 sm:grid-cols-2">
			{#if bucketName}
				<div>
					<dt class="text-sm font-medium text-gray-500 dark:text-gray-400">Bucket Name</dt>
					<dd class="mt-1">
						<span
							class="inline-flex items-center gap-1.5 rounded-md bg-amber-100 px-2.5 py-1 text-sm font-medium text-amber-800 dark:bg-amber-900/50 dark:text-amber-300"
						>
							<svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path
									stroke-linecap="round"
									stroke-linejoin="round"
									stroke-width="2"
									d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4"
								/>
							</svg>
							{bucketName}
						</span>
					</dd>
				</div>
			{/if}

			{#if endpoint}
				<div class="sm:col-span-2">
					<dt class="text-sm font-medium text-gray-500 dark:text-gray-400">S3 Endpoint</dt>
					<dd class="mt-1">
						<code
							class="rounded bg-gray-100 px-2 py-1 text-sm text-gray-800 dark:bg-gray-700 dark:text-gray-200"
							>{endpoint}</code
						>
						{#if insecure}
							<span
								class="ml-2 inline-flex items-center gap-1 rounded-md bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700 dark:bg-red-900/50 dark:text-red-300"
							>
								<svg class="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
									<path
										stroke-linecap="round"
										stroke-linejoin="round"
										stroke-width="2"
										d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z"
									/>
								</svg>
								Insecure (HTTP)
							</span>
						{/if}
					</dd>
				</div>
			{/if}

			<div>
				<dt class="text-sm font-medium text-gray-500 dark:text-gray-400">Provider</dt>
				<dd class="mt-1">
					<span
						class="inline-flex items-center rounded-md px-2 py-1 text-xs font-medium {provider === 'aws'
							? 'bg-orange-100 text-orange-800 dark:bg-orange-900/50 dark:text-orange-300'
							: provider === 'gcp'
								? 'bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300'
								: provider === 'azure'
									? 'bg-sky-100 text-sky-800 dark:bg-sky-900/50 dark:text-sky-300'
									: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'}"
					>
						{provider}
					</span>
				</dd>
			</div>

			{#if region}
				<div>
					<dt class="text-sm font-medium text-gray-500 dark:text-gray-400">Region</dt>
					<dd class="mt-1">
						<span
							class="inline-flex items-center rounded-md bg-emerald-100 px-2 py-1 text-xs font-medium text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-300"
						>
							{region}
						</span>
					</dd>
				</div>
			{/if}

			{#if prefix}
				<div>
					<dt class="text-sm font-medium text-gray-500 dark:text-gray-400">Prefix</dt>
					<dd class="mt-1">
						<code
							class="rounded bg-gray-100 px-2 py-1 text-sm text-gray-800 dark:bg-gray-700 dark:text-gray-200"
							>{prefix}</code
						>
					</dd>
				</div>
			{/if}

			{#if interval}
				<div>
					<dt class="text-sm font-medium text-gray-500 dark:text-gray-400">Sync Interval</dt>
					<dd class="mt-1 text-sm text-gray-900 dark:text-gray-100">{interval}</dd>
				</div>
			{/if}

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
		</dl>
	</div>

	<!-- Latest Artifact -->
	{#if artifact}
		<div
			class="rounded-lg border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800"
		>
			<h3 class="mb-4 text-lg font-semibold text-gray-900 dark:text-gray-100">Latest Artifact</h3>
			<dl class="grid gap-4 sm:grid-cols-2">
				{#if artifact.revision}
					<div class="sm:col-span-2">
						<dt class="text-sm font-medium text-gray-500 dark:text-gray-400">Revision</dt>
						<dd class="mt-1 font-mono text-sm text-gray-900 dark:text-gray-100">
							{artifact.revision}
						</dd>
					</div>
				{/if}

				{#if artifact.lastUpdateTime}
					<div>
						<dt class="text-sm font-medium text-gray-500 dark:text-gray-400">Last Updated</dt>
						<dd class="mt-1 text-sm text-gray-900 dark:text-gray-100">
							{formatTimestamp(artifact.lastUpdateTime)}
						</dd>
					</div>
				{/if}
			</dl>
		</div>
	{/if}

	<!-- Ignore Patterns -->
	{#if ignore}
		<div
			class="rounded-lg border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800"
		>
			<h3 class="mb-4 text-lg font-semibold text-gray-900 dark:text-gray-100">Ignore Patterns</h3>
			<pre
				class="overflow-auto rounded-lg bg-gray-100 p-4 text-sm text-gray-800 dark:bg-gray-900 dark:text-gray-200"><code
					>{ignore}</code
				></pre>
		</div>
	{/if}
</div>
