<script lang="ts">
	import DetailField from '$lib/components/flux/details/DetailField.svelte';
	import SecretRefBadge from '$lib/components/flux/details/SecretRefBadge.svelte';
	import SuspendedBadge from '$lib/components/flux/details/SuspendedBadge.svelte';
	import type { GitRepositorySecretRef } from './git-repository-detail-types';

	let {
		timeout,
		secretRef,
		suspend,
		ignore
	}: {
		timeout: string | undefined;
		secretRef: GitRepositorySecretRef | undefined;
		suspend: boolean | undefined;
		ignore: string | undefined;
	} = $props();
</script>

{#if timeout || secretRef || suspend !== undefined || ignore}
	<div class="rounded-lg border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800">
		<h3 class="mb-4 text-lg font-semibold text-gray-900 dark:text-gray-100">
			Advanced Configuration
		</h3>
		<dl class="grid gap-4 sm:grid-cols-2">
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

			{#if ignore}
				<div class="sm:col-span-2">
					<dt class="mb-1 text-sm font-medium text-gray-500 dark:text-gray-400">Ignore Patterns</dt>
					<dd>
						<pre
							class="overflow-auto rounded-lg bg-gray-50 p-3 text-sm text-gray-800 dark:bg-gray-900/50 dark:text-gray-200"
						><code>{ignore}</code></pre
						>
					</dd>
				</div>
			{/if}
		</dl>
	</div>
{/if}
