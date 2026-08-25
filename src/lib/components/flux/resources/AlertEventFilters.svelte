<script lang="ts">
	let {
		inclusionList,
		exclusionList
	}: {
		inclusionList: string[] | undefined;
		exclusionList: string[] | undefined;
	} = $props();

	let hasInclusion = $derived((inclusionList?.length ?? 0) > 0);
	let hasExclusion = $derived((exclusionList?.length ?? 0) > 0);
	let hasFilters = $derived(hasInclusion || hasExclusion);
</script>

{#snippet filterGroup(
	title: string,
	patterns: string[],
	headingClass: string,
	badgeClass: string
)}
	<div>
		<h4 class="mb-2 text-sm font-medium {headingClass}">{title}</h4>
		<div class="flex flex-wrap gap-2">
			{#each patterns as pattern (pattern)}
				<span class="inline-flex items-center rounded-md px-2 py-1 text-xs font-medium {badgeClass}">
					{pattern}
				</span>
			{/each}
		</div>
	</div>
{/snippet}

{#if hasFilters}
	<div class="rounded-lg border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800">
		<h3 class="mb-4 text-lg font-semibold text-gray-900 dark:text-gray-100">Event Filters</h3>
		<div class="space-y-4">
			{#if hasInclusion}
				{@render filterGroup(
					'Include (match any)',
					inclusionList ?? [],
					'text-green-700 dark:text-green-400',
					'bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300'
				)}
			{/if}

			{#if hasExclusion}
				{@render filterGroup(
					'Exclude (skip matching)',
					exclusionList ?? [],
					'text-red-700 dark:text-red-400',
					'bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-300'
				)}
			{/if}
		</div>
	</div>
{/if}
