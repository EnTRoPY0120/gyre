<script lang="ts">
	import Skeleton from '$lib/components/ui/Skeleton.svelte';
</script>

<div class="space-y-4">
	{#each Array(3) as _}
		<div class="rounded-lg border border-gray-200 p-4 dark:border-gray-700">
			<div class="flex items-center justify-between">
				<Skeleton class="h-6 w-1/3" />
				<Skeleton class="h-6 w-24 rounded-full" />
			</div>
			<div class="mt-4 grid grid-cols-2 gap-4">
				<Skeleton class="h-32 w-full" />
				<Skeleton class="h-32 w-full" />
			</div>
		</div>
	{/each}
</div>
