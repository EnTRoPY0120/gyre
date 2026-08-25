<script lang="ts">
	import DetailSection from '$lib/components/flux/details/DetailSection.svelte';
	import SuspendedBadge from '$lib/components/flux/details/SuspendedBadge.svelte';

	let {
		prune,
		force,
		suspend
	}: {
		prune?: boolean;
		force?: boolean;
		suspend?: boolean;
	} = $props();
</script>

<DetailSection title="Reconciliation Settings">
	<div class="flex flex-wrap gap-3">
		<div
			class="flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-2 dark:border-gray-600"
		>
			<span class="text-sm font-medium text-gray-500 dark:text-gray-400">Prune</span>
			<span
				class="inline-flex rounded-md px-2 py-0.5 text-xs font-medium {prune
					? 'bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300'
					: 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400'}"
			>
				{prune ? 'Enabled' : 'Disabled'}
			</span>
		</div>

		<div
			class="flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-2 dark:border-gray-600"
		>
			<span class="text-sm font-medium text-gray-500 dark:text-gray-400">Force</span>
			<span
				class="inline-flex rounded-md px-2 py-0.5 text-xs font-medium {force
					? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/50 dark:text-yellow-300'
					: 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400'}"
			>
				{force ? 'Enabled' : 'Disabled'}
			</span>
		</div>

		<div
			class="flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-2 dark:border-gray-600"
		>
			<span class="text-sm font-medium text-gray-500 dark:text-gray-400">Suspended</span>
			<SuspendedBadge suspended={Boolean(suspend)} />
		</div>
	</div>
</DetailSection>
