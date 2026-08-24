<script lang="ts">
	import DetailField from '$lib/components/flux/details/DetailField.svelte';
	import SuspendedBadge from '$lib/components/flux/details/SuspendedBadge.svelte';

	let {
		releaseName,
		targetNamespace,
		interval,
		timeout,
		suspend
	}: {
		releaseName: string | undefined;
		targetNamespace: string | undefined;
		interval: string | undefined;
		timeout: string | undefined;
		suspend: boolean | undefined;
	} = $props();
</script>


	<div class="rounded-lg border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800">
		<h3 class="mb-4 text-lg font-semibold text-gray-900 dark:text-gray-100">
			Release Configuration
		</h3>
		<dl class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
			{#if releaseName}
				<div>
					<dt class="text-sm font-medium text-gray-500 dark:text-gray-400">Release Name</dt>
					<dd class="mt-1 text-sm font-medium text-gray-900 dark:text-gray-100">{releaseName}</dd>
				</div>
			{/if}

			{#if targetNamespace}
				<div>
					<dt class="text-sm font-medium text-gray-500 dark:text-gray-400">Target Namespace</dt>
					<dd class="mt-1">
						<span
							class="inline-flex items-center rounded-md bg-green-100 px-2 py-1 text-xs font-medium text-green-800 dark:bg-green-900/50 dark:text-green-300"
						>
							{targetNamespace}
						</span>
					</dd>
				</div>
			{/if}

			{#if interval}
				<DetailField label="Reconcile Interval">
					<span class="text-sm text-gray-900 dark:text-gray-100">{interval}</span>
				</DetailField>
			{/if}

			{#if timeout}
				<DetailField label="Timeout">
					<span class="text-sm text-gray-900 dark:text-gray-100">{timeout}</span>
				</DetailField>
			{/if}

			{#if suspend !== undefined}
				<DetailField label="Suspended">
					<SuspendedBadge suspended={suspend} />
				</DetailField>
			{/if}
		</dl>
	</div>
