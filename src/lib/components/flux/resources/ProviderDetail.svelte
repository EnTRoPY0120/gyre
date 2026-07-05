<script lang="ts">
	import DetailField from '$lib/components/flux/details/DetailField.svelte';
	import SecretRefBadge from '$lib/components/flux/details/SecretRefBadge.svelte';
	import SuspendedBadge from '$lib/components/flux/details/SuspendedBadge.svelte';
	import TlsCertBadge from '$lib/components/flux/details/TlsCertBadge.svelte';
	import type { FluxResource } from '$lib/types/flux';

	interface Props {
		resource: FluxResource;
	}

	let { resource }: Props = $props();

	const spec = $derived(resource.spec || {});

	const type = $derived(spec.type as string | undefined);
	const channel = $derived(spec.channel as string | undefined);
	const address = $derived(spec.address as string | undefined);
	const username = $derived(spec.username as string | undefined);
	const secretRef = $derived(spec.secretRef as { name: string } | undefined);
	const certSecretRef = $derived(spec.certSecretRef as { name: string } | undefined);
	const proxy = $derived(spec.proxy as string | undefined);
	const timeout = $derived(spec.timeout as string | undefined);
	const suspend = $derived(spec.suspend as boolean | undefined);

	// Map provider type to display info
	const providerTypeInfo = $derived.by(() => {
		const typeMap: Record<string, { label: string; color: string }> = {
			slack: {
				label: 'Slack',
				color: 'bg-purple-100 text-purple-800 dark:bg-purple-900/50 dark:text-purple-300'
			},
			discord: {
				label: 'Discord',
				color: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/50 dark:text-indigo-300'
			},
			msteams: {
				label: 'Microsoft Teams',
				color: 'bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300'
			},
			github: {
				label: 'GitHub',
				color: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
			},
			gitlab: {
				label: 'GitLab',
				color: 'bg-orange-100 text-orange-800 dark:bg-orange-900/50 dark:text-orange-300'
			},
			googlechat: {
				label: 'Google Chat',
				color: 'bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300'
			},
			opsgenie: {
				label: 'OpsGenie',
				color: 'bg-sky-100 text-sky-800 dark:bg-sky-900/50 dark:text-sky-300'
			},
			pagerduty: {
				label: 'PagerDuty',
				color: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-300'
			},
			generic: {
				label: 'Generic Webhook',
				color: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
			},
			'generic-hmac': {
				label: 'Generic (HMAC)',
				color: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
			},
			telegram: {
				label: 'Telegram',
				color: 'bg-cyan-100 text-cyan-800 dark:bg-cyan-900/50 dark:text-cyan-300'
			},
			matrix: {
				label: 'Matrix',
				color: 'bg-teal-100 text-teal-800 dark:bg-teal-900/50 dark:text-teal-300'
			}
		};
		return typeMap[type || ''] || { label: type || 'Unknown', color: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300' };
	});
</script>

<div class="space-y-6">
	<!-- Provider Configuration -->
	<div class="rounded-lg border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800">
		<h3 class="mb-4 text-lg font-semibold text-gray-900 dark:text-gray-100">
			Provider Configuration
		</h3>
		<dl class="grid gap-4 sm:grid-cols-2">
			{#if type}
				<div>
					<dt class="text-sm font-medium text-gray-500 dark:text-gray-400">Provider Type</dt>
					<dd class="mt-1">
						<span
							class="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-sm font-medium {providerTypeInfo.color}"
						>
							<svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path
									stroke-linecap="round"
									stroke-linejoin="round"
									stroke-width="2"
									d="M13 10V3L4 14h7v7l9-11h-7z"
								/>
							</svg>
							{providerTypeInfo.label}
						</span>
					</dd>
				</div>
			{/if}

			{#if channel}
				<div>
					<dt class="text-sm font-medium text-gray-500 dark:text-gray-400">Channel</dt>
					<dd class="mt-1">
						<span
							class="inline-flex items-center gap-1 rounded-md bg-blue-100 px-2 py-1 text-xs font-medium text-blue-800 dark:bg-blue-900/50 dark:text-blue-300"
						>
							# {channel}
						</span>
					</dd>
				</div>
			{/if}

			{#if address}
				<div class="sm:col-span-2">
					<dt class="text-sm font-medium text-gray-500 dark:text-gray-400">Webhook Address</dt>
					<dd class="mt-1">
						<code
							class="rounded bg-gray-100 px-2 py-1 text-sm text-gray-800 dark:bg-gray-700 dark:text-gray-200"
							>{address}</code
						>
					</dd>
				</div>
			{/if}

			{#if username}
				<div>
					<dt class="text-sm font-medium text-gray-500 dark:text-gray-400">Username</dt>
					<dd class="mt-1 text-sm text-gray-900 dark:text-gray-100">{username}</dd>
				</div>
			{/if}

			{#if timeout}
				<DetailField label="Timeout">
					<span class="text-sm text-gray-900 dark:text-gray-100">{timeout}</span>
				</DetailField>
			{/if}

			{#if proxy}
				<div class="sm:col-span-2">
					<dt class="text-sm font-medium text-gray-500 dark:text-gray-400">Proxy URL</dt>
					<dd class="mt-1">
						<code
							class="rounded bg-gray-100 px-2 py-1 text-sm text-gray-800 dark:bg-gray-700 dark:text-gray-200"
							>{proxy}</code
						>
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

	<!-- Secrets & Authentication -->
	{#if secretRef || certSecretRef}
		<div
			class="rounded-lg border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800"
		>
			<h3 class="mb-4 text-lg font-semibold text-gray-900 dark:text-gray-100">
				Secrets & Authentication
			</h3>
			<dl class="grid gap-4 sm:grid-cols-2">
				{#if secretRef}
					<DetailField label="Token/Secret">
						<SecretRefBadge name={secretRef.name} />
					</DetailField>
				{/if}
				{#if certSecretRef}
					<DetailField label="TLS Certificate">
						<TlsCertBadge name={certSecretRef.name} />
					</DetailField>
				{/if}
			</dl>
		</div>
	{/if}
</div>
