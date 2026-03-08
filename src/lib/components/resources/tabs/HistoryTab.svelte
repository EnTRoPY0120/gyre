<script lang="ts">
	import VersionHistory from '$lib/components/flux/VersionHistory.svelte';
	import Skeleton from '$lib/components/ui/Skeleton.svelte';
	import type { ReconciliationEntry } from '$lib/types/resource';

	interface Props {
		timeline: ReconciliationEntry[];
		loading: boolean;
		onRefresh: () => void;
		onRollback: (id: string, revision: string | null) => void;
	}

	let { timeline, loading, onRefresh, onRollback }: Props = $props();
</script>

<div
	class="rounded-lg border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800"
>
	<div class="mb-4 flex items-center justify-between">
		<h3 class="text-lg font-semibold text-gray-900 dark:text-gray-100">Version History</h3>
		<button
			type="button"
			class="inline-flex items-center gap-1.5 rounded-md bg-gray-100 px-3 py-1.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-200 disabled:opacity-50 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600"
			onclick={onRefresh}
			disabled={loading}
			aria-label="Refresh history"
		>
			<svg
				class="h-4 w-4 {loading ? 'animate-spin' : ''}"
				fill="none"
				stroke="currentColor"
				viewBox="0 0 24 24"
			>
				<path
					stroke-linecap="round"
					stroke-linejoin="round"
					stroke-width="2"
					d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
				/>
			</svg>
			Refresh
		</button>
	</div>

	{#if loading && timeline.length === 0}
		<div class="space-y-6">
			{#each Array(3) as _}
				<div class="flex gap-4">
					<Skeleton class="h-10 w-10 rounded-full" />
					<div class="flex-1 space-y-2">
						<Skeleton class="h-5 w-32" />
						<Skeleton class="h-4 w-full" />
						<Skeleton class="h-4 w-2/3" />
					</div>
				</div>
			{/each}
		</div>
	{:else}
		<VersionHistory {timeline} {loading} onRollback={onRollback} />
	{/if}
</div>
