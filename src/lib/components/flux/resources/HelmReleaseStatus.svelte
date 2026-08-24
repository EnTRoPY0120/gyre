<script lang="ts">
	let {
		lastAppliedRevision,
		lastAttemptedRevision,
		helmChart
	}: {
		lastAppliedRevision: string | undefined;
		lastAttemptedRevision: string | undefined;
		helmChart: string | undefined;
	} = $props();
</script>

{#if lastAppliedRevision || lastAttemptedRevision || helmChart}
	<div class="rounded-lg border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800">
		<h3 class="mb-4 text-lg font-semibold text-gray-900 dark:text-gray-100">Release Status</h3>
		<dl class="grid gap-4 sm:grid-cols-2">
			{#if lastAppliedRevision}
				<div>
					<dt class="text-sm font-medium text-gray-500 dark:text-gray-400">
						Last Applied Revision
					</dt>
					<dd class="mt-1 font-mono text-sm text-gray-900 dark:text-gray-100">
						{lastAppliedRevision}
					</dd>
				</div>
			{/if}

			{#if lastAttemptedRevision}
				<div>
					<dt class="text-sm font-medium text-gray-500 dark:text-gray-400">
						Last Attempted Revision
					</dt>
					<dd class="mt-1 font-mono text-sm text-gray-900 dark:text-gray-100">
						{lastAttemptedRevision}
					</dd>
				</div>
			{/if}

			{#if helmChart}
				<div class="sm:col-span-2">
					<dt class="text-sm font-medium text-gray-500 dark:text-gray-400">
						HelmChart Reference
					</dt>
					<dd class="mt-1 font-mono text-sm text-gray-900 dark:text-gray-100">{helmChart}</dd>
				</div>
			{/if}
		</dl>
	</div>
{/if}
