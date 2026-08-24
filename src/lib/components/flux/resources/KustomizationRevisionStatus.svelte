<script lang="ts">
	import DetailGrid from '$lib/components/flux/details/DetailGrid.svelte';
	import DetailSection from '$lib/components/flux/details/DetailSection.svelte';
	import { formatTimestamp } from '$lib/utils/flux';

	let {
		lastAppliedRevision,
		lastAttemptedRevision,
		lastHandledReconcileAt
	}: {
		lastAppliedRevision?: string;
		lastAttemptedRevision?: string;
		lastHandledReconcileAt?: string;
	} = $props();
</script>

{#if lastAppliedRevision || lastAttemptedRevision || lastHandledReconcileAt}
	<DetailSection title="Revision Status">
		<DetailGrid>
			{#if lastAppliedRevision}
				<div class="sm:col-span-2">
					<dt class="text-sm font-medium text-gray-500 dark:text-gray-400">
						Last Applied Revision
					</dt>
					<dd class="mt-1 font-mono text-sm text-gray-900 dark:text-gray-100">
						{lastAppliedRevision}
					</dd>
				</div>
			{/if}

			{#if lastAttemptedRevision && lastAttemptedRevision !== lastAppliedRevision}
				<div class="sm:col-span-2">
					<dt class="text-sm font-medium text-gray-500 dark:text-gray-400">
						Last Attempted Revision
					</dt>
					<dd class="mt-1 font-mono text-sm text-gray-900 dark:text-gray-100">
						{lastAttemptedRevision}
					</dd>
				</div>
			{/if}

			{#if lastHandledReconcileAt}
				<div>
					<dt class="text-sm font-medium text-gray-500 dark:text-gray-400">Last Reconciled</dt>
					<dd class="mt-1 text-sm text-gray-900 dark:text-gray-100">
						{formatTimestamp(lastHandledReconcileAt)}
					</dd>
				</div>
			{/if}
		</DetailGrid>
	</DetailSection>
{/if}
