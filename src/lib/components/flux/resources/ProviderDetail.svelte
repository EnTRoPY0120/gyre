<script lang="ts">
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
				<div>
					<dt class="text-sm font-medium text-gray-500 dark:text-gray-400">Timeout</dt>
					<dd class="mt-1 text-sm text-gray-900 dark:text-gray-100">{timeout}</dd>
				</div>
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
					<div>
						<dt class="text-sm font-medium text-gray-500 dark:text-gray-400">Token/Secret</dt>
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
				{#if certSecretRef}
					<div>
						<dt class="text-sm font-medium text-gray-500 dark:text-gray-400">TLS Certificate</dt>
						<dd class="mt-1">
							<span
								class="inline-flex items-center gap-1 rounded-md bg-teal-100 px-2 py-1 text-xs font-medium text-teal-800 dark:bg-teal-900/50 dark:text-teal-300"
							>
								<svg class="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
									<path
										stroke-linecap="round"
										stroke-linejoin="round"
										stroke-width="2"
										d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
									/>
								</svg>
								{certSecretRef.name}
							</span>
						</dd>
					</div>
				{/if}
			</dl>
		</div>
	{/if}
</div>
