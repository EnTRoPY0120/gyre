<script lang="ts">
	let {
		inclusionList,
		exclusionList
	}: {
		inclusionList: string[] | undefined;
		exclusionList: string[] | undefined;
	} = $props();
</script>

{#if (inclusionList && inclusionList.length > 0) || (exclusionList && exclusionList.length > 0)}
	<div class="rounded-lg border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800">
		<h3 class="mb-4 text-lg font-semibold text-gray-900 dark:text-gray-100">Event Filters</h3>
		<div class="space-y-4">
			{#if inclusionList && inclusionList.length > 0}
				<div>
					<h4 class="mb-2 text-sm font-medium text-green-700 dark:text-green-400">
						Include (match any)
					</h4>
					<div class="flex flex-wrap gap-2">
						{#each inclusionList as pattern (pattern)}
							<span
								class="inline-flex items-center rounded-md bg-green-100 px-2 py-1 text-xs font-medium text-green-800 dark:bg-green-900/50 dark:text-green-300"
							>
								{pattern}
							</span>
						{/each}
					</div>
				</div>
			{/if}

			{#if exclusionList && exclusionList.length > 0}
				<div>
					<h4 class="mb-2 text-sm font-medium text-red-700 dark:text-red-400">
						Exclude (skip matching)
					</h4>
					<div class="flex flex-wrap gap-2">
						{#each exclusionList as pattern (pattern)}
							<span
								class="inline-flex items-center rounded-md bg-red-100 px-2 py-1 text-xs font-medium text-red-800 dark:bg-red-900/50 dark:text-red-300"
							>
								{pattern}
							</span>
						{/each}
					</div>
				</div>
			{/if}
		</div>
	</div>
{/if}
