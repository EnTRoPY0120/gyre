<script lang="ts">
	import type { FluxResource } from '$lib/types/flux';
	import ArtifactSummary from '$lib/components/flux/details/ArtifactSummary.svelte';
	import DetailField from '$lib/components/flux/details/DetailField.svelte';
	import IgnorePatternsPanel from '$lib/components/flux/details/IgnorePatternsPanel.svelte';
	import SecretRefBadge from '$lib/components/flux/details/SecretRefBadge.svelte';
	import SuspendedBadge from '$lib/components/flux/details/SuspendedBadge.svelte';

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
				<DetailField label="Sync Interval">
					<span class="text-sm text-gray-900 dark:text-gray-100">{interval}</span>
				</DetailField>
			{/if}

			{#if timeout}
				<DetailField label="Timeout">
					<span class="text-sm text-gray-900 dark:text-gray-100">{timeout}</span>
				</DetailField>
			{/if}

			{#if secretRef}
				<DetailField label="Authentication Secret">
					<SecretRefBadge name={secretRef.name} />
				</DetailField>
			{/if}

			{#if suspend !== undefined}
				<DetailField label="Suspended">
					<SuspendedBadge suspended={suspend} />
				</DetailField>
			{/if}
		</dl>
	</div>

	<!-- Latest Artifact -->
	{#if artifact}
		<ArtifactSummary {artifact} />
	{/if}

	<!-- Ignore Patterns -->
	{#if ignore}
		<IgnorePatternsPanel {ignore} />
	{/if}
</div>
