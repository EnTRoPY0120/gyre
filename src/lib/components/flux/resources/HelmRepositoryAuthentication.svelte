<script lang="ts">
	import DetailField from '$lib/components/flux/details/DetailField.svelte';
	import SecretRefBadge from '$lib/components/flux/details/SecretRefBadge.svelte';
	import TlsCertBadge from '$lib/components/flux/details/TlsCertBadge.svelte';
import type { HelmRepositorySecretRef } from './helm-repository-detail-types';

	let {
		secretRef,
		certSecretRef,
		passCredentials
	}: {
		secretRef: HelmRepositorySecretRef | undefined;
		certSecretRef: HelmRepositorySecretRef | undefined;
		passCredentials: boolean | undefined;
	} = $props();
</script>

{#if secretRef || certSecretRef || passCredentials}
	<div class="rounded-lg border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800">
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
