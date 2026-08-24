<script lang="ts">
	import DetailField from '$lib/components/flux/details/DetailField.svelte';
	import SecretRefBadge from '$lib/components/flux/details/SecretRefBadge.svelte';
	import TlsCertBadge from '$lib/components/flux/details/TlsCertBadge.svelte';
import type { OCIRepositorySecretRef } from './oci-repository-detail-types';

	let {
		secretRef,
		certSecretRef,
		serviceAccountName
	}: {
		secretRef: OCIRepositorySecretRef | undefined;
		certSecretRef: OCIRepositorySecretRef | undefined;
		serviceAccountName: string | undefined;
	} = $props();
</script>

{#if secretRef || certSecretRef || serviceAccountName}
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
