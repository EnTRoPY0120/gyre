<script lang="ts">
	import type { FluxResource } from '$lib/types/flux';
	import ArtifactSummary from '$lib/components/flux/details/ArtifactSummary.svelte';
	import DetailField from '$lib/components/flux/details/DetailField.svelte';
	import DetailTextField from '$lib/components/flux/details/DetailTextField.svelte';
	import IgnorePatternsPanel from '$lib/components/flux/details/IgnorePatternsPanel.svelte';
	import SecretRefBadge from '$lib/components/flux/details/SecretRefBadge.svelte';
	import SuspendedBadge from '$lib/components/flux/details/SuspendedBadge.svelte';
	import TlsCertBadge from '$lib/components/flux/details/TlsCertBadge.svelte';

	interface Props {
		resource: FluxResource;
	}

	let { resource }: Props = $props();

	// Extract OCIRepository-specific fields
	const spec = $derived(resource.spec || {});
	const status = $derived(resource.status || {});

	const url = $derived(spec.url as string | undefined);
	const interval = $derived(spec.interval as string | undefined);
	const timeout = $derived(spec.timeout as string | undefined);
	const ref = $derived(
		spec.ref as { tag?: string; semver?: string; semverFilter?: string; digest?: string } | undefined
	);
	const provider = $derived(spec.provider as string | undefined);
	const secretRef = $derived(spec.secretRef as { name: string } | undefined);
	const certSecretRef = $derived(spec.certSecretRef as { name: string } | undefined);
	const serviceAccountName = $derived(spec.serviceAccountName as string | undefined);
	const insecure = $derived(spec.insecure as boolean | undefined);
	const suspend = $derived(spec.suspend as boolean | undefined);
	const ignore = $derived(spec.ignore as string | undefined);
	const layerSelector = $derived(
		spec.layerSelector as { mediaType?: string; operation?: string } | undefined
	);

	// Artifact info from status
	const artifact = $derived(
		status.artifact as
			| {
					path?: string;
					url?: string;
					revision?: string;
					lastUpdateTime?: string;
					metadata?: Record<string, string>;
			  }
			| undefined
	);
</script>

<div class="space-y-6">
	<!-- OCI Source Configuration -->
	<div class="rounded-lg border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800">
		<h3 class="mb-4 text-lg font-semibold text-gray-900 dark:text-gray-100">
			OCI Source Configuration
		</h3>
		<dl class="grid gap-4 sm:grid-cols-2">
			{#if url}
				<div class="sm:col-span-2">
					<dt class="text-sm font-medium text-gray-500 dark:text-gray-400">OCI Registry URL</dt>
					<dd class="mt-1">
						<span
							class="inline-flex items-center gap-1.5 text-sm font-mono text-gray-900 dark:text-gray-100"
						>
							<svg class="h-4 w-4 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path
									stroke-linecap="round"
									stroke-linejoin="round"
									stroke-width="2"
									d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"
								/>
							</svg>
							{url}
						</span>
						{#if insecure}
							<span
								class="ml-2 inline-flex items-center gap-1 rounded-md bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700 dark:bg-red-900/50 dark:text-red-300"
							>
								Insecure (HTTP)
							</span>
						{/if}
					</dd>
				</div>
			{/if}

			{#if ref}
				<div>
					<dt class="text-sm font-medium text-gray-500 dark:text-gray-400">OCI Reference</dt>
					<dd class="mt-1 text-sm text-gray-900 dark:text-gray-100">
						{#if ref.tag}
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
								class="inline-flex items-center rounded-md bg-green-100 px-2 py-1 text-xs font-medium text-green-800 dark:bg-green-900/50 dark:text-green-300"
							>
								semver: {ref.semver}
							</span>
						{:else if ref.digest}
							<span
								class="inline-flex items-center rounded-md bg-gray-100 px-2 py-1 font-mono text-xs text-gray-800 dark:bg-gray-700 dark:text-gray-200"
							>
								{ref.digest.substring(0, 19)}...
							</span>
						{/if}
					</dd>
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

			{#if interval}
				<DetailTextField label="Sync Interval" value={interval} />
			{/if}

			{#if timeout}
				<DetailTextField label="Timeout" value={timeout} />
			{/if}

			{#if suspend !== undefined}
				<DetailField label="Suspended">
					<SuspendedBadge suspended={suspend} />
				</DetailField>
			{/if}
		</dl>
	</div>

	<!-- Layer Selector -->
	{#if layerSelector}
		<div
			class="rounded-lg border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800"
		>
			<h3 class="mb-4 text-lg font-semibold text-gray-900 dark:text-gray-100">Layer Selector</h3>
			<dl class="grid gap-4 sm:grid-cols-2">
				{#if layerSelector.mediaType}
					<div>
						<dt class="text-sm font-medium text-gray-500 dark:text-gray-400">Media Type</dt>
						<dd class="mt-1">
							<code
								class="rounded bg-gray-100 px-2 py-1 text-sm text-gray-800 dark:bg-gray-700 dark:text-gray-200"
								>{layerSelector.mediaType}</code
							>
						</dd>
					</div>
				{/if}
				{#if layerSelector.operation}
					<div>
						<dt class="text-sm font-medium text-gray-500 dark:text-gray-400">Operation</dt>
						<dd class="mt-1">
							<span
								class="inline-flex items-center rounded-md bg-violet-100 px-2 py-1 text-xs font-medium text-violet-800 dark:bg-violet-900/50 dark:text-violet-300"
							>
								{layerSelector.operation}
							</span>
						</dd>
					</div>
				{/if}
			</dl>
		</div>
	{/if}

	<!-- Authentication & TLS -->
	{#if secretRef || certSecretRef || serviceAccountName}
		<div
			class="rounded-lg border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800"
		>
			<h3 class="mb-4 text-lg font-semibold text-gray-900 dark:text-gray-100">
				Authentication & TLS
			</h3>
			<dl class="grid gap-4 sm:grid-cols-2">
				{#if secretRef}
					<DetailField label="Authentication Secret">
						<SecretRefBadge name={secretRef.name} />
					</DetailField>
				{/if}

				{#if certSecretRef}
					<DetailField label="TLS Certificate">
						<TlsCertBadge name={certSecretRef.name} />
					</DetailField>
				{/if}

				{#if serviceAccountName}
					<div>
						<dt class="text-sm font-medium text-gray-500 dark:text-gray-400">Service Account</dt>
						<dd class="mt-1">
							<span
								class="inline-flex items-center gap-1 rounded-md bg-purple-100 px-2 py-1 text-xs font-medium text-purple-800 dark:bg-purple-900/50 dark:text-purple-300"
							>
								<svg class="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
									<path
										stroke-linecap="round"
										stroke-linejoin="round"
										stroke-width="2"
										d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
									/>
								</svg>
								{serviceAccountName}
							</span>
						</dd>
					</div>
				{/if}
			</dl>
		</div>
	{/if}

	<!-- Latest Artifact -->
	{#if artifact}
		<ArtifactSummary {artifact} />
	{/if}

	<!-- Ignore Patterns -->
	{#if ignore}
		<IgnorePatternsPanel {ignore} />
	{/if}
</div>
