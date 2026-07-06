<script lang="ts">
	import type { FluxResource } from '$lib/types/flux';
	import ArtifactSummary from '$lib/components/flux/details/ArtifactSummary.svelte';
	import DetailField from '$lib/components/flux/details/DetailField.svelte';
	import DetailTextField from '$lib/components/flux/details/DetailTextField.svelte';
	import SecretRefBadge from '$lib/components/flux/details/SecretRefBadge.svelte';
	import SuspendedBadge from '$lib/components/flux/details/SuspendedBadge.svelte';
	import TlsCertBadge from '$lib/components/flux/details/TlsCertBadge.svelte';
	import { isSafeExternalUrl } from '$lib/utils/url';

	interface Props {
		resource: FluxResource;
	}

	let { resource }: Props = $props();

	// Extract HelmRepository-specific fields
	const spec = $derived(resource.spec || {});
	const status = $derived(resource.status || {});

	const url = $derived(spec.url as string | undefined);
	const isSafeUrl = $derived(isSafeExternalUrl(url));
	const type = $derived((spec.type as string | undefined) || 'default');
	const interval = $derived(spec.interval as string | undefined);
	const timeout = $derived(spec.timeout as string | undefined);
	const secretRef = $derived(spec.secretRef as { name: string } | undefined);
	const passCredentials = $derived(spec.passCredentials as boolean | undefined);
	const suspend = $derived(spec.suspend as boolean | undefined);
	const provider = $derived(spec.provider as string | undefined);
	const certSecretRef = $derived(spec.certSecretRef as { name: string } | undefined);

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
	<!-- Repository Configuration -->
	<div class="rounded-lg border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800">
		<h3 class="mb-4 text-lg font-semibold text-gray-900 dark:text-gray-100">
			Repository Configuration
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

			<div>
				<dt class="text-sm font-medium text-gray-500 dark:text-gray-400">Repository Type</dt>
				<dd class="mt-1">
					<span
						class="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium {type === 'oci'
							? 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/50 dark:text-indigo-300'
							: 'bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300'}"
					>
						<svg class="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								stroke-width="2"
								d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4"
							/>
						</svg>
						{type === 'oci' ? 'OCI' : 'Helm (Default)'}
					</span>
				</dd>
			</div>

			{#if interval}
				<DetailTextField label="Sync Interval" value={interval} />
			{/if}

			{#if timeout}
				<DetailTextField label="Timeout" value={timeout} />
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
				<DetailField label="Suspended">
					<SuspendedBadge suspended={suspend} />
				</DetailField>
			{/if}
		</dl>
	</div>

	<!-- Authentication & TLS -->
	{#if secretRef || certSecretRef || passCredentials}
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

				{#if passCredentials !== undefined}
					<div>
						<dt class="text-sm font-medium text-gray-500 dark:text-gray-400">Pass Credentials</dt>
						<dd class="mt-1">
							<span
								class="inline-flex rounded-md px-2 py-0.5 text-xs font-medium {passCredentials
									? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/50 dark:text-yellow-300'
									: 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400'}"
							>
								{passCredentials ? 'Enabled' : 'Disabled'}
							</span>
						</dd>
					</div>
				{/if}
			</dl>
		</div>
	{/if}

	<!-- Latest Artifact -->
	{#if artifact}
		<ArtifactSummary {artifact} showPath />
	{/if}
</div>
